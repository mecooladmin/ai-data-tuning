import { randomUUID } from "crypto";
import { db, jobsTable, uploadedFilesTable, timelineEventsTable, jobOutputsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { extractFile } from "./extractor.js";
import { extractEvents, mergeAndSortEvents } from "./nlp.js";
import { generateMasterDocument, generateRagChunks, generateFineTuneExamples, generateValidationReport } from "./output-generator.js";
import type { DetectedEvent } from "./types.js";
import { logger } from "../logger.js";

export async function processJob(jobId: string): Promise<void> {
  // Mark as processing
  await db.update(jobsTable).set({ status: "processing", updatedAt: new Date() }).where(eq(jobsTable.id, jobId));

  try {
    const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, jobId) });
    if (!job) throw new Error(`Job ${jobId} not found`);

    const files = await db.select().from(uploadedFilesTable).where(eq(uploadedFilesTable.jobId, jobId));

    let processedFiles = 0;
    const allEvents: DetectedEvent[] = [];

    for (const file of files) {
      try {
        logger.info({ fileId: file.id, filename: file.filename }, "Extracting file");

        const extracted = await extractFile(file.storagePath, file.filename, file.mimeType);

        // Update raw text in DB
        await db
          .update(uploadedFilesTable)
          .set({ rawText: extracted.rawText })
          .where(eq(uploadedFilesTable.id, file.id));

        // Extract events from this file
        const events = extractEvents(extracted.rawText, file.filename);
        allEvents.push(...events);
        processedFiles++;

        logger.info({ fileId: file.id, eventsFound: events.length }, "File processed");
      } catch (fileErr) {
        logger.error({ fileId: file.id, err: fileErr }, "Failed to process file");
      }
    }

    // Sort and merge all events
    const sortedEvents = mergeAndSortEvents(allEvents);

    // Clear existing timeline events for this job
    await db.delete(timelineEventsTable).where(eq(timelineEventsTable.jobId, jobId));

    // Insert timeline events
    for (let i = 0; i < sortedEvents.length; i++) {
      const event = sortedEvents[i];
      await db.insert(timelineEventsTable).values({
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
      });
    }

    // Generate outputs
    const masterDocument = generateMasterDocument(sortedEvents, job.name);
    const ragChunks = generateRagChunks(sortedEvents);
    const fineTuneExamples = generateFineTuneExamples(sortedEvents, job.name);
    const validationReport = generateValidationReport(files.length, processedFiles, sortedEvents);

    // Delete existing output and insert new
    await db.delete(jobOutputsTable).where(eq(jobOutputsTable.jobId, jobId));
    await db.insert(jobOutputsTable).values({
      id: randomUUID(),
      jobId,
      masterDocument,
      ragChunks: JSON.stringify(ragChunks),
      fineTuneExamples: JSON.stringify(fineTuneExamples),
      validationReport: JSON.stringify(validationReport),
    });

    // Mark as completed
    await db.update(jobsTable).set({ status: "completed", updatedAt: new Date() }).where(eq(jobsTable.id, jobId));

    logger.info({ jobId, events: sortedEvents.length, ragChunks: ragChunks.length }, "Job completed");
  } catch (err) {
    logger.error({ jobId, err }, "Job failed");
    await db
      .update(jobsTable)
      .set({
        status: "failed",
        errorMessage: String(err),
        updatedAt: new Date(),
      })
      .where(eq(jobsTable.id, jobId));
  }
}
