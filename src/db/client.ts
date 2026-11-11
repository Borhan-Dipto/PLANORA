import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Server-only. Never import this file from client components.
//
// Use Supabase's Session-mode pooler (port 5432) instead of the Transaction-mode pooler
// (port 6543). Both run through the same Supavisor host, but transaction mode is where the
// recurring "canceling statement due to statement timeout" / "CONNECTION_DESTROYED" / "cancel
// unanswered" failures were coming from — confirmed by a direct EXPLAIN ANALYZE of the exact
// failing query (profiles lookup by PK) running in 0.08ms on the database itself, so the DB was
// never the bottleneck. Session mode holds one dedicated backend per connection instead of
// Supavisor's transaction-level multiplexing, which is the more failure-prone path on Supabase's
// shared pooler infra. At max:1 connection per function instance this costs nothing — we only
// ever hold one backend anyway — and it's still fully IPv4-compatible (required on Vercel).
const connectionString = (() => {
  const url = new URL(process.env.DATABASE_URL!);
  if (url.port === "6543") url.port = "5432";
  return url.toString();
})();

// Serverless-friendly pool: max:1 per function instance (Supabase's own guidance for serverless +
// pooler — a higher max here just means more sockets held per cold-started instance). Drop idle
// sockets before a frozen function instance can resume on a dead one, fail fast if a connection
// can't be opened, and force-cancel+reconnect a query that hangs instead of waiting up to
// Postgres's own statement_timeout (2 min) and then Vercel's 300s function cap — which is what
// "this page could not load" was. max_lifetime periodically recycles connections so a function
// instance can't keep reusing one that's gone stale.
const client = postgres(connectionString, {
  prepare: false,
  max: 1,
  idle_timeout: 20,
  connect_timeout: 10,
  query_timeout: 8,
  max_lifetime: 60 * 5,
});

export const db = drizzle(client, { schema });

/**
 * Retries a DB call once more if it fails for a transient connection reason (the pooler handing
 * back a dead/hanging backend) — the kind of failure a page reload would also fix, just done
 * automatically so the user never sees it. Does NOT retry real query errors (bad SQL, constraint
 * violations, etc.) — only ones that mean "the connection itself didn't work this time".
 */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const code = (err as { code?: string })?.code ?? (err as { cause?: { code?: string } })?.cause?.code;
      const transient = code === "QUERY_TIMEOUT" || code === "CONNECTION_DESTROYED" || code === "CONNECT_TIMEOUT" || code === "57014";
      if (!transient || attempt >= attempts) throw err;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
}
