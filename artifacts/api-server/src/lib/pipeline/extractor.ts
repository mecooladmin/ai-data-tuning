import fs from "fs/promises";
import path from "path";
import type { ExtractedData } from "./types.js";

async function extractPdf(filePath: string, filename: string): Promise<ExtractedData> {
  try {
    // Dynamic import to handle potential build issues
    const pdfParse = await import("pdf-parse").then((m) => m.default || m);
    const buffer = await fs.readFile(filePath);
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

async function extractImage(filePath: string, filename: string, mimeType: string): Promise<ExtractedData> {
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

async function extractDocx(filePath: string, filename: string): Promise<ExtractedData> {
  try {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ path: filePath });
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

async function extractText(filePath: string, filename: string, mimeType: string): Promise<ExtractedData> {
  const text = await fs.readFile(filePath, "utf-8");
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

export async function extractFile(filePath: string, filename: string, mimeType: string): Promise<ExtractedData> {
  const ext = path.extname(filename).toLowerCase();

  if (mimeType === "application/pdf" || ext === ".pdf") {
    return extractPdf(filePath, filename);
  }

  if (mimeType.startsWith("image/") || [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"].includes(ext)) {
    return extractImage(filePath, filename, mimeType);
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    ext === ".docx"
  ) {
    return extractDocx(filePath, filename);
  }

  if (mimeType.startsWith("text/") || [".txt", ".md", ".csv", ".json", ".xml", ".html"].includes(ext)) {
    return extractText(filePath, filename, mimeType);
  }

  // Fallback: try reading as text
  try {
    return extractText(filePath, filename, mimeType);
  } catch {
    return {
      rawText: `[Cannot extract content from file type: ${mimeType}]`,
      filename,
      mimeType,
      metadata: { dates: [] },
    };
  }
}
