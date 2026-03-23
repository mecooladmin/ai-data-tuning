export interface ExtractedData {
  rawText: string;
  filename: string;
  mimeType: string;
  metadata: {
    dates: string[];
    author?: string;
    title?: string;
    source?: string;
    pages?: number;
  };
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
