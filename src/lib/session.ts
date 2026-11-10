import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";

/** Returns the signed-in user's id or redirects to /login. */
export async function requireUserId() {
  await connection(); // request-time only (avoids Date.now() prerender errors from the auth client)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}

/** Signed-in + role is admin/super_admin, or redirects to /dashboard. Every admin page and action calls this. */
export async function requireAdminId(): Promise<{ userId: string; role: "admin" | "super_admin" }> {
  const userId = await requireUserId();
  const [profile] = await db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId));
  if (!profile || (profile.role !== "admin" && profile.role !== "super_admin")) redirect("/dashboard");
  return { userId, role: profile.role };
}
