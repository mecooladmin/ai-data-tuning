import { Router, type IRouter } from "express";
import multer from "multer";
import path from "path";
import { randomUUID } from "crypto";
import {
  db,
  jobsTable,
  uploadedFilesTable,
  timelineEventsTable,
  jobOutputsTable,
  documentSegmentsTable,
} from "@workspace/db";
import { eq, desc, count } from "drizzle-orm";
import { processJob } from "../lib/pipeline/processor.js";
import { extractFileFromBuffer } from "../lib/pipeline/extractor.js";
import { PIPELINE_CONFIG } from "../lib/pipeline/config.js";
import { CreateJobBody } from "@workspace/api-zod";

const router: IRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PIPELINE_CONFIG.maxFileSizeBytes,
    files: PIPELINE_CONFIG.maxFilesPerRequest,
  },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowed =
      PIPELINE_CONFIG.supportedMimeTypes.includes(file.mimetype as any) ||
      PIPELINE_CONFIG.supportedExtensions.includes(ext as any);
    if (!allowed) {
      cb(new Error(`Unsupported file type: ${file.mimetype} (${ext})`));
    } else {
      cb(null, true);
    }
  },
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
      const [{ value: fileCount }] = await db
        .select({ value: count() })
        .from(uploadedFilesTable)
        .where(eq(uploadedFilesTable.jobId, job.id));
      return jobToResponse(job, Number(fileCount));
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

  const [job] = await db
    .insert(jobsTable)
    .values({
      id: randomUUID(),
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      status: "pending",
    })
    .returning();

  res.status(201).json(jobToResponse(job, 0));
});

// GET /jobs/:jobId
router.get("/jobs/:jobId", async (req, res) => {
  const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, req.params.jobId) });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const files = await db
    .select({
      id: uploadedFilesTable.id,
      jobId: uploadedFilesTable.jobId,
      filename: uploadedFilesTable.filename,
      mimeType: uploadedFilesTable.mimeType,
      sizeBytes: uploadedFilesTable.sizeBytes,
      createdAt: uploadedFilesTable.createdAt,
    })
    .from(uploadedFilesTable)
    .where(eq(uploadedFilesTable.jobId, job.id));

  res.json({
    ...jobToResponse(job, files.length),
    files: files.map((f) => ({
      ...f,
      createdAt: f.createdAt.toISOString(),
    })),
  });
});

// POST /jobs/:jobId/upload
router.post("/jobs/:jobId/upload", upload.array("file", PIPELINE_CONFIG.maxFilesPerRequest), async (req, res) => {
  const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, req.params.jobId) });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
    res.status(400).json({ error: "No files uploaded. Use field name 'file'." });
    return;
  }

  const [{ value: existingCount }] = await db
    .select({ value: count() })
    .from(uploadedFilesTable)
    .where(eq(uploadedFilesTable.jobId, job.id));

  const files = Array.isArray(req.files) ? req.files : Object.values(req.files).flat();

  if (Number(existingCount) + files.length > PIPELINE_CONFIG.maxFilesPerJob) {
    res.status(400).json({
      error: `Job already has ${existingCount} files. Max is ${PIPELINE_CONFIG.maxFilesPerJob} per job.`,
    });
    return;
  }

  const uploaded = [];

  for (const file of files) {
    const extracted = await extractFileFromBuffer(file.buffer, file.originalname, file.mimetype).catch(() => null);

    const [record] = await db
      .insert(uploadedFilesTable)
      .values({
        id: randomUUID(),
        jobId: job.id,
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storagePath: "",
        rawText: extracted?.rawText ?? null,
      })
      .returning();

    // Persist structured segments to the DB (best-effort)
    if (extracted?.segments && extracted.segments.length > 0) {
      const segmentRows = extracted.segments.map((seg) => ({
        id: randomUUID(),
        fileId: record.id,
        jobId: job.id,
        segmentIndex: seg.index,
        page: seg.page ?? null,
        text: seg.text,
        sourceOffset: seg.sourceOffset ?? null,
        extractor: seg.extractor ?? null,
        confidence: seg.confidence ?? null,
      }));
      await db.insert(documentSegmentsTable).values(segmentRows).catch((err) => {
        req.log.warn({ err, fileId: record.id }, "Failed to persist segments");
      });
    }

    uploaded.push({
      id: record.id,
      jobId: record.jobId,
      filename: record.filename,
      mimeType: record.mimeType,
      sizeBytes: record.sizeBytes,
      segmentCount: extracted?.segments?.length ?? 0,
      createdAt: record.createdAt.toISOString(),
    });
  }

  await db.update(jobsTable).set({ updatedAt: new Date() }).where(eq(jobsTable.id, job.id));

  if (uploaded.length === 1) {
    res.status(201).json(uploaded[0]);
  } else {
    res.status(201).json({ files: uploaded });
  }
});

// POST /jobs/:jobId/process
router.post("/jobs/:jobId/process", async (req, res) => {
  const job = await db.query.jobsTable.findFirst({ where: eq(jobsTable.id, req.params.jobId) });
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  const [{ value: fileCount }] = await db
    .select({ value: count() })
    .from(uploadedFilesTable)
    .where(eq(uploadedFilesTable.jobId, job.id));

  res.status(202).json(jobToResponse(job, Number(fileCount)));

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

  const output = await db.query.jobOutputsTable.findFirst({
    where: eq(jobOutputsTable.jobId, job.id),
  });

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

// Multer error handler
router.use((err: any, _req: any, res: any, next: any) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ error: `File too large. Maximum size is ${PIPELINE_CONFIG.maxFileSizeMB} MB.` });
      return;
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({ error: `Too many files. Maximum ${PIPELINE_CONFIG.maxFilesPerRequest} per request.` });
      return;
    }
    res.status(400).json({ error: err.message });
    return;
  }
  if (err?.message?.startsWith("Unsupported file type")) {
    res.status(415).json({ error: err.message });
    return;
  }
  next(err);
});

export default router;
