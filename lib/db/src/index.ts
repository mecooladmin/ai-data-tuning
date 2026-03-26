import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });

export * from "./schema";
// Re-export the new documentSegmentsTable and its types.  This ensures callers
// can import it directly from "@workspace/db" without referencing a deep
// schema path, and avoids circular dependencies by re-exporting here.
export { documentSegmentsTable, type DocumentSegment } from "./schema/segments";
