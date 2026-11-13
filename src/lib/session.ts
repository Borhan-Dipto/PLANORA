import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db, withDbRetry } from "@/db/client";
import { profiles } from "@/db/schema";

/** Returns the signed-in user's id or redirects to /login. */
export async function requireUserId() {
  await connection(); // request-time only (avoids Date.now() prerender errors from the auth client)
  const supabase = await createClient();
  // getClaims verifies the JWT locally (cached signing keys) instead of a round trip to the auth
  // server on every page/action — the biggest fixed cost per request.
  const { data } = await supabase.auth.getClaims();
  const id = data?.claims?.sub;
  if (!id) redirect("/login");
  return id;
}

type StaffRole = "moderator" | "manager" | "admin" | "super_admin";
const STAFF_ROLES: readonly StaffRole[] = ["moderator", "manager", "admin", "super_admin"];

/** Signed-in + role is staff (moderator/manager/admin/super_admin), or redirects to /dashboard.
 * Every admin page and action calls this. */
export async function requireAdminId(): Promise<{ userId: string; role: StaffRole }> {
  const userId = await requireUserId();
  const [profile] = await withDbRetry(() =>
    db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)),
  );
  if (!profile || !STAFF_ROLES.includes(profile.role as StaffRole)) redirect("/dashboard");
  return { userId, role: profile.role as StaffRole };
}

/** Signed-in + role is exactly super_admin, or redirects to /dashboard. Use for actions only the
 * owner should be able to do — e.g. assigning staff roles to other users. */
export async function requireSuperAdminId(): Promise<{ userId: string }> {
  const userId = await requireUserId();
  const [profile] = await withDbRetry(() =>
    db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)),
  );
  if (!profile || profile.role !== "super_admin") redirect("/dashboard");
  return { userId };
}

/** Non-redirecting check: true iff this user's role is exactly super_admin. For conditionally
 * showing/allowing a super_admin-only capability (e.g. custom plan duration) without gating the
 * whole page behind requireSuperAdminId's redirect. */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const [profile] = await withDbRetry(() =>
    db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)),
  );
  return profile?.role === "super_admin";
}
