import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { __cpPool?: Pool };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const needsSsl = /sslmode=require|neon\.tech|supabase\.co|render\.com|amazonaws\.com/.test(url);
  return new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
  });
}

const pool = globalForDb.__cpPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__cpPool = pool;

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { pool, schema };
