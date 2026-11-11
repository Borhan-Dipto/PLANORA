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
//
// query_timeout is the critical addition: Supavisor (the pooler) occasionally hands back a
// backend that never answers — confirmed by seeing a plain indexed single-row lookup (0.08ms
// when run directly against Postgres) still hit Postgres's own 120s statement_timeout through
// the pooler. Without a client-side limit, a single stuck connection held the whole (max:1) pool
// hostage for up to 120s, then the Vercel function itself died at its 300s cap — which is what
// "this page could not load" was. query_timeout force-cancels and reconnects after 8s instead,
// so a stuck pooler backend costs a few seconds, not a dead page. max_lifetime periodically
// recycles connections so a function instance can't keep reusing one that's gone stale.
const client = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  query_timeout: 8,
  max_lifetime: 60 * 5,
});

export const db = drizzle(client, { schema });
