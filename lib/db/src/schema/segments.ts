import { pgTable, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { uploadedFilesTable, jobsTable, timelineEventsTable } from "./jobs";

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

export const entitiesTable = pgTable("entities", {
  id: text("id").primaryKey(),
  jobId: text("job_id")
    .notNull()
    .references(() => jobsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type").notNull(),
  normalizedName: text("normalized_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const eventEntitiesTable = pgTable("event_entities", {
  id: text("id").primaryKey(),
  eventId: text("event_id")
    .notNull()
    .references(() => timelineEventsTable.id, { onDelete: "cascade" }),
  entityId: text("entity_id")
    .notNull()
    .references(() => entitiesTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DocumentSegment = typeof documentSegmentsTable.$inferSelect;
export type InsertDocumentSegment = typeof documentSegmentsTable.$inferInsert;
export type Entity = typeof entitiesTable.$inferSelect;
export type EventEntity = typeof eventEntitiesTable.$inferSelect;
