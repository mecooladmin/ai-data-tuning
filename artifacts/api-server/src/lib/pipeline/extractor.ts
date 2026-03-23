import fs from "fs/promises";
import path from "path";
import type { ExtractedData } from "./types.js";

async function extractPdfFromBuffer(buffer: Buffer, filename: string): Promise<ExtractedData> {
  try {
    const pdfParse = await import("pdf-parse").then((m) => m.default || m);
    const data = await pdfParse(buffer);
    return {
      rawText: data.text || "",
      filename,
      mimeType: "application/pdf",
      metadata: {
        dates: extractDatesFromText(data.text || ""),
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
    return {
      rawText: data.text || "",
      filename,
      mimeType,
      metadata: {
        dates: extractDatesFromText(data.text || ""),
      },
    };
  } catch (err) {
    return {
      rawText: `[OCR extraction failed: ${String(err)}]`,
      filename,
      mimeType,
      metadata: { dates: [] },
    };
  }
}

async function extractDocxFromBuffer(buffer: Buffer, filename: string): Promise<ExtractedData> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return {
      rawText: result.value || "",
      filename,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      metadata: {
        dates: extractDatesFromText(result.value || ""),
      },
    };
  } catch (err) {
    return {
      rawText: `[DOCX extraction failed: ${String(err)}]`,
      filename,
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      metadata: { dates: [] },
    };
  }
}

function extractTextFromBuffer(buffer: Buffer, filename: string, mimeType: string): ExtractedData {
  const text = buffer.toString("utf-8");
  return {
    rawText: text,
    filename,
    mimeType,
    metadata: {
      dates: extractDatesFromText(text),
    },
  };
}

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
    if (matches) {
      matches.forEach((m) => found.add(m.trim()));
    }
  }
  return Array.from(found);
}

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
    // OCR needs a file path — write to temp if path not provided
    const workPath = tempPath ?? `/tmp/${randomId()}_${path.basename(filename)}`;
    if (!tempPath) {
      await fs.writeFile(workPath, buffer);
    }
    const result = await extractImageFromPath(workPath, filename, mimeType);
    if (!tempPath) {
      await fs.unlink(workPath).catch(() => {});
    }
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

  // Fallback: try reading as text
  try {
    return extractTextFromBuffer(buffer, filename, mimeType);
  } catch {
    return {
      rawText: `[Cannot extract content from file type: ${mimeType}]`,
      filename,
      mimeType,
      metadata: { dates: [] },
    };
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Legacy path-based extractor (kept for backward compat)
export async function extractFile(filePath: string, filename: string, mimeType: string): Promise<ExtractedData> {
  const ext = path.extname(filename).toLowerCase();

  if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"].includes(ext)) {
    return extractImageFromPath(filePath, filename, mimeType);
  }

  const buffer = await fs.readFile(filePath);
  return extractFileFromBuffer(buffer, filename, mimeType, filePath);
}
