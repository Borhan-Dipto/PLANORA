import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Server-only. Never import this file from client components.
const connectionString = process.env.DATABASE_URL!;

// Serverless-friendly settings for the Supabase pooler (Supavisor, transaction mode, port 6543):
// Supabase's own guidance for this setup is max:1 per function instance — transaction-mode
// pooling already multiplexes many short-lived serverless invocations onto a small number of
// real Postgres backends, so each instance only ever needs one connection at a time. A higher
// max here just means more sockets held per cold-started instance, which is exactly what can
// pile up into a pool-exhaustion stall (seen as "statement timeout" / "task timed out after
// 300s" on trivial single-row queries during a burst of concurrent testers). Also drop idle
// sockets before a frozen function instance can resume on a dead one, and fail fast instead of
// waiting forever when a connection can't be opened.
const client = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
