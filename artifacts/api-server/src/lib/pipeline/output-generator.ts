import { randomUUID } from "crypto";
import type { DetectedEvent, RagChunk, FineTuneExample, ValidationReport } from "./types.js";

export function generateMasterDocument(events: DetectedEvent[], jobName: string): string {
  const lines: string[] = [];

  lines.push(`# MASTER DOCUMENT: ${jobName}`);
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Total Events: ${events.length}`);
  lines.push("=".repeat(80));
  lines.push("");
  lines.push("## CHRONOLOGICAL TIMELINE");
  lines.push("");

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    lines.push(`### Event ${i + 1}`);
    lines.push("");

    if (event.date) {
      const dateLabel = event.dateInferred
        ? `[INFERRED - ${event.dateConfidence ?? "context"}] ${event.date}`
        : `[EXPLICIT] ${event.date}`;
      lines.push(`**Date:** ${dateLabel}`);
    } else {
      lines.push(`**Date:** [UNKNOWN - no date found]`);
    }

    if (event.eventType) {
      lines.push(`**Type:** ${event.eventType.replace(/_/g, " ").toUpperCase()}`);
    }

    lines.push(`**Source:** ${event.sourceFile}`);
    if (event.sourceLocation) {
      lines.push(`**Location:** ${event.sourceLocation}`);
    }

    if (event.entities.length > 0) {
      lines.push(`**Entities:** ${event.entities.join(", ")}`);
    }

    lines.push("");
    lines.push(`**Description:**`);
    lines.push(event.description);
    lines.push("");
    lines.push("-".repeat(60));
    lines.push("");
  }

  return lines.join("\n");
}

export function generateRagChunks(events: DetectedEvent[]): RagChunk[] {
  return events.map((event, i) => {
    // Enrich chunk text with surrounding context
    const contextBefore = events.slice(Math.max(0, i - 1), i).map((e) => e.description).join(" ");
    const contextAfter = events.slice(i + 1, i + 2).map((e) => e.description).join(" ");
    const enrichedText = `${contextBefore} ${event.description} ${contextAfter}`.trim();

    return {
      id: randomUUID(),
      text: enrichedText,
      metadata: {
        date: event.date,
        dateInferred: event.dateInferred,
        source: event.sourceFile,
        sourceLocation: event.sourceLocation,
        entities: event.entities,
        eventType: event.eventType,
      },
    };
  });
}

export function generateFineTuneExamples(events: DetectedEvent[], jobName: string): FineTuneExample[] {
  const examples: FineTuneExample[] = [];

  // Group events by date to generate contextual Q&A
  const byDate = new Map<string, DetectedEvent[]>();
  for (const event of events) {
    const key = event.date ?? "undated";
    const existing = byDate.get(key) ?? [];
    existing.push(event);
    byDate.set(key, existing);
  }

  for (const [date, dateEvents] of byDate) {
    if (date === "undated") continue;
    const context = dateEvents.map((e) => e.description).join(" ");

    examples.push({
      input: `What happened on ${date} according to the ${jobName} documents?`,
      output: dateEvents.map((e) => e.description).join("\n"),
      context,
    });
  }

  // Generate entity-based examples
  const entityMap = new Map<string, DetectedEvent[]>();
  for (const event of events) {
    for (const entity of event.entities) {
      const existing = entityMap.get(entity) ?? [];
      existing.push(event);
      entityMap.set(entity, existing);
    }
  }

  for (const [entity, entityEvents] of entityMap) {
    if (entityEvents.length < 2) continue;
    const context = entityEvents.map((e) => e.description).join(" ");

    examples.push({
      input: `What is the full timeline of events involving ${entity}?`,
      output: entityEvents
        .map((e) => (e.date ? `[${e.date}] ` : "") + e.description)
        .join("\n"),
      context,
    });
  }

  return examples.slice(0, 50);
}

export function generateValidationReport(
  totalFiles: number,
  processedFiles: number,
  events: DetectedEvent[]
): ValidationReport {
  const allEntities = new Set<string>();
  let conflictsDetected = 0;

  for (const event of events) {
    for (const entity of event.entities) {
      allEntities.add(entity);
    }
  }

  // Check for date conflicts (same entity, wildly different dates)
  const entityDates = new Map<string, string[]>();
  for (const event of events) {
    if (!event.date) continue;
    for (const entity of event.entities) {
      const dates = entityDates.get(entity) ?? [];
      dates.push(event.date);
      entityDates.set(entity, dates);
    }
  }

  for (const dates of entityDates.values()) {
    if (dates.length > 1) {
      const sorted = [...dates].sort();
      for (let i = 1; i < sorted.length; i++) {
        const prev = new Date(sorted[i - 1]).getTime();
        const curr = new Date(sorted[i]).getTime();
        const diffDays = Math.abs(curr - prev) / (1000 * 60 * 60 * 24);
        if (diffDays > 365 * 5) conflictsDetected++;
      }
    }
  }

  const dataLossRisk =
    processedFiles < totalFiles
      ? `HIGH - ${totalFiles - processedFiles} files failed to process`
      : events.length === 0
        ? "MEDIUM - no events detected in any file"
        : "LOW - all files processed, events extracted";

  return {
    totalFiles,
    processedFiles,
    totalEvents: events.length,
    totalEntities: allEntities.size,
    conflictsDetected,
    dataLossRisk,
  };
}
