import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const jobsTable = pgTable("jobs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  status: jobStatusEnum("status").notNull().default("pending"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertJobSchema = createInsertSchema(jobsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertJob = z.infer<typeof insertJobSchema>;
export type Job = typeof jobsTable.$inferSelect;

export const uploadedFilesTable = pgTable("uploaded_files", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  rawText: text("raw_text"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertFileSchema = createInsertSchema(uploadedFilesTable).omit({
  createdAt: true,
});
export type InsertFile = z.infer<typeof insertFileSchema>;
export type UploadedFile = typeof uploadedFilesTable.$inferSelect;

export const timelineEventsTable = pgTable("timeline_events", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  date: text("date"),
  dateInferred: integer("date_inferred").notNull().default(0),
  dateConfidence: text("date_confidence"),
  description: text("description").notNull(),
  sourceFile: text("source_file").notNull(),
  sourceLocation: text("source_location"),
  entities: text("entities").notNull().default("[]"),
  eventType: text("event_type"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type TimelineEvent = typeof timelineEventsTable.$inferSelect;

export const jobOutputsTable = pgTable("job_outputs", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" })
    .unique(),
  masterDocument: text("master_document").notNull(),
  ragChunks: text("rag_chunks").notNull().default("[]"),
  fineTuneExamples: text("fine_tune_examples").notNull().default("[]"),
  validationReport: text("validation_report").notNull().default("{}"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type JobOutput = typeof jobOutputsTable.$inferSelect;
