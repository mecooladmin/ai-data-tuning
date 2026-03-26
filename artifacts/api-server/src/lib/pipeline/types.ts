export interface ExtractedData {
  rawText: string;
  /**
   * Name of the file that was processed.
   */
  filename: string;
  /**
   * MIME type of the file.
   */
  mimeType: string;
  /**
   * A list of structured segments extracted from the document.  Segments retain
   * ordering information and optional page/offset metadata.  When no
   * segmentation is possible, this array is empty.
   */
  segments: ExtractedSegment[];
  /**
   * Metadata extracted at the document level.  Contains dates found in the
   * document and, when available, author, title, source and page count.
   */
  metadata: {
    dates: string[];
    author?: string;
    title?: string;
    source?: string;
    pages?: number;
  };
}

/**
 * A fine‑grained piece of text extracted from a file.  Segments are
 * zero‑indexed in the order they appear in the source document.  When the
 * underlying extractor can provide page numbers or character offsets, those
 * values are included.  Bounding boxes and confidence are populated for
 * image‑based extractions.
 */
export interface ExtractedSegment {
  /**
   * Zero‑based index of this segment in its parent file.
   */
  index: number;
  /**
   * The page number associated with this segment, if applicable.  Otherwise
   * null.
   */
  page: number | null;
  /**
   * The text content of the segment.
   */
  text: string;
  /**
   * Optional character offset from the start of the document where this segment
   * begins.
   */
  sourceOffset?: number;
  /**
   * Optional bounding box for image‑based segments, encoded as a JSON string or
   * object with x,y,width,height properties.
   */
  bbox?: any;
  /**
   * Name of the extractor that produced this segment.
   */
  extractor?: string;
  /**
   * Optional confidence score between 0 and 100.
   */
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
