import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Server-only. Never import this file from client components.
const connectionString = process.env.DATABASE_URL!;

// Serverless-friendly settings for the Supabase pooler: drop idle sockets before a frozen
// function instance can resume on a dead one (that showed up as a 300 s hung /dashboard), and
// fail fast instead of waiting forever when a connection can't be opened.
const client = postgres(connectionString, {
  prepare: false,
  max: 5,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
