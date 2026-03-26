import { pgTable, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { uploadedFilesTable } from "./jobs";

export const documentSegmentsTable = pgTable("document_segments", {
  id: text("id").primaryKey(),
  fileId: text("file_id")
    .notNull()
    .references(() => uploadedFilesTable.id, { onDelete: "cascade" }),
  jobId: text("job_id").notNull(),
  segmentIndex: integer("segment_index").notNull(),
  page: integer("page"),
  text: text("text").notNull(),
  sourceOffset: integer("source_offset"),
  extractor: text("extractor"),
  confidence: real("confidence"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DocumentSegment = typeof documentSegmentsTable.$inferSelect;
export type InsertDocumentSegment = typeof documentSegmentsTable.$inferInsert;
