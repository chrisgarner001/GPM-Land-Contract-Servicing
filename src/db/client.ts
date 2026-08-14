import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env.local and fill it in.");
}

// DATABASE_URL points at Supabase's TRANSACTION-mode pooler (port 6543) —
// multiplexes many short-lived serverless connections onto a small number
// of real Postgres backends, rather than session mode's 1:1 mapping capped
// at a fixed client count. Switched to this after repeatedly hitting
// session mode's "max clients reached" under ordinary use (a same-day
// "Contract not found" that was actually a full connection pool, not a
// missing row). `prepare: false` is required in transaction mode — a named
// prepared statement can't be reused reliably once pgbouncer may hand
// different statements in the "same" client session to different backend
// connections. `max`/`idle_timeout` still bound this app's own footprint.
const queryClient = postgres(process.env.DATABASE_URL, { max: 3, idle_timeout: 20, prepare: false });
export const db = drizzle(queryClient, { schema });
