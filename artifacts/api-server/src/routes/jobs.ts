import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { randomUUID } from "crypto";
import { db, jobsTable, uploadedFilesTable, timelineEventsTable, jobOutputsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { processJob } from "../lib/pipeline/processor.js";
import {
  CreateJobBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");

// Ensure uploads dir exists
async function ensureUploadsDir() {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
}
ensureUploadsDir().catch(() => {});

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
});

function jobToResponse(job: typeof jobsTable.$inferSelect, fileCount = 0) {
  return {
    id: job.id,
    name: job.name,
    description: job.description ?? null,
    status: job.status,
    fileCount,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    errorMessage: job.errorMessage ?? null,
  };
}

// GET /jobs
router.get("/jobs", async (req, res) => {
  const jobs = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt));

  const results = await Promise.all(
    jobs.map(async (job) => {
      const files = await db.select({ id: uploadedFilesTable.id }).from(uploadedFilesTable).where(eq(uploadedFilesTable.jobId, job.id));
      return jobToResponse(job, files.length);
    })
  );

  res.json({ jobs: results });
});

// POST /jobs
router.post("/jobs", async (req, res) => {
  const parsed = CreateJobBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const job = await db
    .insert(jobsTable)
    .values({
      id: randomUUID(),
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: "pending",
    })
    .returning();

  res.status(201).json(jobToResponse(job[0], 0));
});

// GET /jobs/:jobId
router.get("/jobs/:jobId", async (req, res) => {
  const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, req.params.jobId) });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const files = await db.select().from(uploadedFilesTable).where(eq(uploadedFilesTable.jobId, job.id));

  res.json({
    ...jobToResponse(job, files.length),
    files: files.map((f) => ({
      id: f.id,
      jobId: f.jobId,
      filename: f.filename,
      mimeType: f.mimeType,
      sizeBytes: f.sizeBytes,
      createdAt: f.createdAt.toISOString(),
    })),
  });
});

// POST /jobs/:jobId/upload
router.post("/jobs/:jobId/upload", upload.single("file"), async (req, res) => {
  const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, req.params.jobId) });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "No file uploaded" });
    return;
  }

  const fileRecord = await db
    .insert(uploadedFilesTable)
    .values({
      id: randomUUID(),
      jobId: job.id,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
      sizeBytes: req.file.size,
      storagePath: req.file.path,
    })
    .returning();

  // Update job updatedAt
  await db.update(jobsTable).set({ updatedAt: new Date() }).where(eq(jobsTable.id, job.id));

  res.status(201).json({
    id: fileRecord[0].id,
    jobId: fileRecord[0].jobId,
    filename: fileRecord[0].filename,
    mimeType: fileRecord[0].mimeType,
    sizeBytes: fileRecord[0].sizeBytes,
    createdAt: fileRecord[0].createdAt.toISOString(),
  });
});

// POST /jobs/:jobId/process
router.post("/jobs/:jobId/process", async (req, res) => {
  const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, req.params.jobId) });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const files = await db.select({ id: uploadedFilesTable.id }).from(uploadedFilesTable).where(eq(uploadedFilesTable.jobId, job.id));

  // Respond immediately, then process async
  res.status(202).json(jobToResponse(job, files.length));

  // Non-blocking
  processJob(job.id).catch((err) => {
    req.log.error({ err, jobId: job.id }, "Background processing failed");
  });
});

// GET /jobs/:jobId/timeline
router.get("/jobs/:jobId/timeline", async (req, res) => {
  const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, req.params.jobId) });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const events = await db
    .select()
    .from(timelineEventsTable)
    .where(eq(timelineEventsTable.jobId, job.id))
    .orderBy(timelineEventsTable.sortOrder);

  res.json({
    events: events.map((e) => ({
      id: e.id,
      date: e.date ?? null,
      dateInferred: e.dateInferred === 1,
      dateConfidence: e.dateConfidence ?? null,
      description: e.description,
      sourceFile: e.sourceFile,
      sourceLocation: e.sourceLocation ?? null,
      entities: JSON.parse(e.entities ?? "[]"),
      eventType: e.eventType ?? null,
    })),
  });
});

// GET /jobs/:jobId/outputs
router.get("/jobs/:jobId/outputs", async (req, res) => {
  const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, req.params.jobId) });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const output = await db.query.jobOutputsTable.findFirst({ where: eq(jobOutputsTable.jobId, job.id) });

  if (!output) {
    res.json({
      masterDocument: "",
      ragChunks: [],
      fineTuneExamples: [],
      validationReport: {
        totalFiles: 0,
        processedFiles: 0,
        totalEvents: 0,
        totalEntities: 0,
        conflictsDetected: 0,
        dataLossRisk: "UNKNOWN - not yet processed",
      },
    });
    return;
  }

  res.json({
    masterDocument: output.masterDocument,
    ragChunks: JSON.parse(output.ragChunks ?? "[]"),
    fineTuneExamples: JSON.parse(output.fineTuneExamples ?? "[]"),
    validationReport: JSON.parse(output.validationReport ?? "{}"),
  });
});

export default router;
