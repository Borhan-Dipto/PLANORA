import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client. SERVER-ONLY, TRUSTED CODE ONLY.
 * Bypasses RLS — never import this into any client-reachable code path
 * (Client Components, or Server Actions that echo arbitrary input back).
 * Use only for: admin operations, webhooks, scheduled jobs.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
