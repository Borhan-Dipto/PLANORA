import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signOut } from "@/lib/actions/auth";
import { redirect } from "next/navigation";

// TODO(Phase 2): adopt Suspense + `use cache: private` streaming pattern
// instead of blocking the whole route on the session read.
export const instant = false;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">আজ কী পড়ব?</h1>
      <p className="mt-2 text-gray-600">
        স্বাগতম, {profile?.displayName ?? user.email}
      </p>
      <p className="mt-1 text-sm text-gray-400">এখনো কোনো প্ল্যান নেই। Planner ফেজ-৩-এ আসবে।</p>
      <form action={signOut} className="mt-6">
        <button className="rounded border px-3 py-1.5 text-sm">লগ আউট</button>
      </form>
    </main>
  );
}
