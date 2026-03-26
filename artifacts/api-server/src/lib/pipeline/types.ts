export interface ExtractedData {
  rawText: string;
  filename: string;
  mimeType: string;
  /**
   * Structured segments extracted from the document — one per paragraph/block.
   * Retains ordering and optional page/offset metadata.
   */
  segments: ExtractedSegment[];
  metadata: {
    dates: string[];
    author?: string;
    title?: string;
    source?: string;
    pages?: number;
  };
}

/**
 * A fine-grained piece of text extracted from a file. Segments are
 * zero-indexed in document order. Page numbers and bounding boxes are
 * populated when the extractor can provide them (e.g. OCR).
 */
export interface ExtractedSegment {
  index: number;
  page: number | null;
  text: string;
  sourceOffset?: number;
  bbox?: any;
  extractor?: string;
  confidence?: number;
}

export interface DetectedEntity {
  text: string;
  type: "PERSON" | "ORG" | "PLACE" | "DATE" | "EVENT" | "OTHER";
}

export interface DetectedEvent {
  date: string | null;
  dateInferred: boolean;
  dateConfidence: string | null;
  description: string;
  sourceFile: string;
  sourceLocation: string | null;
  entities: string[];
  eventType: string | null;
}

export interface RagChunk {
  id: string;
  text: string;
  metadata: {
    date: string | null;
    source: string;
    entities: string[];
    eventType: string | null;
  };
}

export interface FineTuneExample {
  input: string;
  output: string;
  context: string;
}

export interface ValidationReport {
  totalFiles: number;
  processedFiles: number;
  totalEvents: number;
  totalEntities: number;
  conflictsDetected: number;
  dataLossRisk: string;
}
