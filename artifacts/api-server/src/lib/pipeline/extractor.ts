import fs from "fs/promises";
import path from "path";
import type { ExtractedData, ExtractedSegment } from "./types.js";

// ---------------------------------------------------------------------------
// Node.js polyfills for browser APIs expected by pdf-parse / pdfjs-dist
// ---------------------------------------------------------------------------
function applyPdfPolyfills() {
  const g = globalThis as any;
  if (!g.DOMMatrix) g.DOMMatrix = class DOMMatrix {};
  if (!g.Path2D) g.Path2D = class Path2D {};
  if (!g.ImageData)
    g.ImageData = class ImageData {
      constructor(public data: Uint8ClampedArray, public width: number, public height: number) {}
    };
}

// ---------------------------------------------------------------------------
// segmentText — split a block of text into ordered paragraph segments
// ---------------------------------------------------------------------------
export function segmentText(text: string): ExtractedSegment[] {
  const lines = text.split(/\r?\n/);
  const segments: ExtractedSegment[] = [];
  let buffer: string[] = [];

  function flush() {
    const content = buffer.join("\n").trim();
    if (content) {
      segments.push({ index: segments.length, page: null, text: content });
    }
    buffer = [];
  }

  for (const line of lines) {
    if (line.trim() === "") {
      flush();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return segments;
}

// ---------------------------------------------------------------------------
// Format-specific extractors
// ---------------------------------------------------------------------------

async function extractPdfFromBuffer(buffer: Buffer, filename: string): Promise<ExtractedData> {
  applyPdfPolyfills();

  try {
    const pdfParse = await import("pdf-parse").then((m) => m.default || m);
    const data = await pdfParse(buffer, { max: 50 });
    const rawText = (data.text || "").trim();
    const segments = segmentText(rawText);

    return {
      rawText,
      filename,
      mimeType: "application/pdf",
      segments,
      metadata: {
        dates: extractDatesFromText(rawText),
        title: data.info?.Title || undefined,
        author: data.info?.Author || undefined,
        pages: data.numpages,
      },
    };
  } catch (err) {
    return {
      rawText: `[PDF extraction failed: ${String(err)}]`,
      filename,
      mimeType: "application/pdf",
      segments: [],
      metadata: { dates: [] },
    };
  }
}

async function extractImageFromPath(filePath: string, filename: string, mimeType: string): Promise<ExtractedData> {
  try {
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker("eng");
    const { data } = await worker.recognize(filePath);
    await worker.terminate();
    const rawText = data.text || "";
    const segments = segmentText(rawText);
    return {
      rawText,
      filename,
      mimeType,
      segments,
      metadata: { dates: extractDatesFromText(rawText) },
    };
  } catch (err) {
    return {
      rawText: `[OCR extraction failed: ${String(err)}]`,
      filename,
      mimeType,
      segments: [],
      metadata: { dates: [] },
    };
  }
}

async function extractDocxFromBuffer(buffer: Buffer, filename: string): Promise<ExtractedData> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    const rawText = result.value || "";
    const segments = segmentText(rawText);
    return {
      rawText,
      filename,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      segments,
      metadata: { dates: extractDatesFromText(rawText) },
    };
  } catch (err) {
    return {
      rawText: `[DOCX extraction failed: ${String(err)}]`,
      filename,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      segments: [],
      metadata: { dates: [] },
    };
  }
}

function extractTextFromBuffer(buffer: Buffer, filename: string, mimeType: string): ExtractedData {
  const text = buffer.toString("utf-8");
  const segments = segmentText(text);
  return {
    rawText: text,
    filename,
    mimeType,
    segments,
    metadata: { dates: extractDatesFromText(text) },
  };
}

// ---------------------------------------------------------------------------
// Date extraction helper
// ---------------------------------------------------------------------------
export function extractDatesFromText(text: string): string[] {
  const patterns = [
    /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g,
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/g,
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2},?\s+\d{4}\b/gi,
    /\b\d{4}\b/g,
  ];

  const found = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) matches.forEach((m) => found.add(m.trim()));
  }
  return Array.from(found);
}

// ---------------------------------------------------------------------------
// Main entry point — buffer-based (Vercel / Azure / in-memory compatible)
// ---------------------------------------------------------------------------
export async function extractFileFromBuffer(
  buffer: Buffer,
  filename: string,
  mimeType: string,
  tempPath?: string
): Promise<ExtractedData> {
  const ext = path.extname(filename).toLowerCase();

  if (mimeType === "application/pdf" || ext === ".pdf") {
    return extractPdfFromBuffer(buffer, filename);
  }

  if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"].includes(ext)) {
    const workPath = tempPath ?? `/tmp/${randomId()}_${path.basename(filename)}`;
    if (!tempPath) await fs.writeFile(workPath, buffer);
    const result = await extractImageFromPath(workPath, filename, mimeType);
    if (!tempPath) await fs.unlink(workPath).catch(() => {});
    return result;
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    return extractDocxFromBuffer(buffer, filename);
  }

  if (mimeType.startsWith("text/") || [".txt", ".md", ".csv", ".json", ".xml", ".html"].includes(ext)) {
    return extractTextFromBuffer(buffer, filename, mimeType);
  }

  // Fallback: try reading as plain text
  try {
    return extractTextFromBuffer(buffer, filename, mimeType);
  } catch {
    return {
      rawText: `[Cannot extract content from file type: ${mimeType}]`,
      filename,
      mimeType,
      segments: [],
      metadata: { dates: [] },
    };
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// ---------------------------------------------------------------------------
// Legacy path-based extractor (kept for backward compat)
// ---------------------------------------------------------------------------
export async function extractFile(filePath: string, filename: string, mimeType: string): Promise<ExtractedData> {
  const ext = path.extname(filename).toLowerCase();

  if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"].includes(ext)) {
    return extractImageFromPath(filePath, filename, mimeType);
  }

  const buffer = await fs.readFile(filePath);
  return extractFileFromBuffer(buffer, filename, mimeType, filePath);
}
