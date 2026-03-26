import { randomUUID } from "crypto";
import { db, jobsTable, uploadedFilesTable, timelineEventsTable, jobOutputsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractFile } from "./extractor.js";
import { extractEvents, mergeAndSortEvents } from "./nlp.js";
import {
  generateMasterDocument,
  generateRagChunks,
  generateFineTuneExamples,
  generateValidationReport,
} from "./output-generator.js";
import type { DetectedEvent } from "./types.js";
import { logger } from "../logger.js";

export async function processJob(jobId: string): Promise<void> {
  await db
    .update(jobsTable)
    .set({
      status: "processing",
      stage: "extraction",
      progress: 10,
      updatedAt: new Date(),
    })
    .where(eq(jobsTable.id, jobId));

  try {
    const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, jobId) });
    if (!job) throw new Error(`Job ${jobId} not found`);

    const files = await db.select().from(uploadedFilesTable).where(eq(uploadedFilesTable.jobId, jobId));

    let processedFiles = 0;
    const allEvents: DetectedEvent[] = [];

    const isExtractionError = (t: string | null) =>
      !t ||
      t.startsWith("[PDF extraction failed:") ||
      t.startsWith("[OCR extraction failed:") ||
      t.startsWith("[DOCX extraction failed:") ||
      t.startsWith("[Cannot extract") ||
      t.startsWith("[No content");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        logger.info({ fileId: file.id, filename: file.filename }, "Processing file");

        let rawText: string;

        if (file.rawText && !isExtractionError(file.rawText)) {
          // Fast path: text was extracted at upload time (memory/Vercel-compatible)
          rawText = file.rawText;
          logger.info({ fileId: file.id }, "Using pre-extracted text from DB");
        } else if (file.storagePath) {
          // Fallback: re-extract from disk (legacy / local dev only)
          const extracted = await extractFile(file.storagePath, file.filename, file.mimeType);
          rawText = extracted.rawText;
          // Cache it back
          await db
            .update(uploadedFilesTable)
            .set({ rawText })
            .where(eq(uploadedFilesTable.id, file.id));
        } else {
          rawText = `[No content available for ${file.filename}]`;
        }

        const events = extractEvents(rawText, file.filename);
        allEvents.push(...events);
        processedFiles++;

        logger.info({ fileId: file.id, eventsFound: events.length }, "File processed");
      } catch (fileErr) {
        logger.error({ fileId: file.id, err: fileErr }, "Failed to process file");
      }

      const progress = 10 + Math.floor(((i + 1) / files.length) * 40);
      await db.update(jobsTable).set({ progress, updatedAt: new Date() }).where(eq(jobsTable.id, jobId));
    }

    // 2. Normalization Stage
    await db.update(jobsTable).set({
      stage: "normalization",
      progress: 50,
      updatedAt: new Date(),
    }).where(eq(jobsTable.id, jobId));

    // 3. Event Detection Stage
    await db.update(jobsTable).set({
      stage: "event_detection",
      progress: 60,
      updatedAt: new Date(),
    }).where(eq(jobsTable.id, jobId));

    // 4. Timeline Merge Stage
    await db.update(jobsTable).set({
      stage: "timeline_merge",
      progress: 70,
      updatedAt: new Date(),
    }).where(eq(jobsTable.id, jobId));

    const sortedEvents = mergeAndSortEvents(allEvents);

    // Clear existing timeline events
    await db.delete(timelineEventsTable).where(eq(timelineEventsTable.jobId, jobId));

    // Batch insert events (100 at a time)
    if (sortedEvents.length > 0) {
      const eventRows = sortedEvents.map((event, i) => ({
        id: randomUUID(),
        jobId,
        date: event.date,
        dateInferred: event.dateInferred ? 1 : 0,
        dateConfidence: event.dateConfidence,
        description: event.description,
        sourceFile: event.sourceFile,
        sourceLocation: event.sourceLocation,
        entities: JSON.stringify(event.entities),
        eventType: event.eventType,
        sortOrder: i,
      }));

      for (let i = 0; i < eventRows.length; i += 100) {
        await db.insert(timelineEventsTable).values(eventRows.slice(i, i + 100));
      }
    }

    // 5. Output Generation Stage
    await db.update(jobsTable).set({
      stage: "output_generation",
      progress: 90,
      updatedAt: new Date(),
    }).where(eq(jobsTable.id, jobId));

    const masterDocument = generateMasterDocument(sortedEvents, job.name);
    const ragChunks = generateRagChunks(sortedEvents);
    const fineTuneExamples = generateFineTuneExamples(sortedEvents, job.name);
    const validationReport = generateValidationReport(files.length, processedFiles, sortedEvents);

    await db.delete(jobOutputsTable).where(eq(jobOutputsTable.jobId, jobId));
    await db.insert(jobOutputsTable).values({
      id: randomUUID(),
      jobId,
      masterDocument,
      ragChunks: JSON.stringify(ragChunks),
      fineTuneExamples: JSON.stringify(fineTuneExamples),
      validationReport: JSON.stringify(validationReport),
    });

    await db
      .update(jobsTable)
      .set({
        status: "completed",
        stage: "completed",
        progress: 100,
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));

    logger.info({ jobId, events: sortedEvents.length }, "Job completed");
  } catch (err) {
    logger.error({ jobId, err }, "Job failed");
    await db
      .update(jobsTable)
      .set({ status: "failed", errorMessage: String(err), updatedAt: new Date() })
      .where(eq(jobsTable.id, jobId));
  }
}
