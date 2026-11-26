import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { setDefaultResultOrder } from "node:dns";
import { setDefaultAutoSelectFamily } from "node:net";
import { Pool } from "pg";
import * as schema from "./schema";

// Node's "happy eyeballs" gives each resolved address only 250 ms. From high-latency
// networks (and without IPv6) every attempt to the database is aborted and the connect
// fails with an AggregateError, which also crashes the Next.js dev renderer even when
// the query error is caught. Connect to one address, IPv4 first, and rely on the pool's
// connection timeout instead.
setDefaultAutoSelectFamily(false);
setDefaultResultOrder("ipv4first");

const globalForDb = globalThis as unknown as { __cpPool?: Pool };

function createPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  const needsSsl = /sslmode=require|neon\.tech|supabase\.co|render\.com|amazonaws\.com/.test(url);
  const pool = new Pool({
    connectionString: url,
    max: Number(process.env.DB_POOL_MAX ?? 10),
    ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
    // Fail fast instead of hanging when the database host is unreachable.
    connectionTimeoutMillis: Number(process.env.DB_CONNECT_TIMEOUT_MS ?? 10000),
  });
  // An idle client losing its connection emits "error" on the pool; without a
  // listener Node treats it as an uncaught exception and the server crashes.
  pool.on("error", (err) => console.error("pg pool error", err));
  return pool;
}

const pool = globalForDb.__cpPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.__cpPool = pool;

export const db: NodePgDatabase<typeof schema> = drizzle(pool, { schema });
export type DB = typeof db;
export type Tx = Parameters<Parameters<DB["transaction"]>[0]>[0];
export { pool, schema };
