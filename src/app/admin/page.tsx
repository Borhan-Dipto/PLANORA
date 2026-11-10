import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";

// TODO(Phase 2): adopt Suspense + `use cache: private` streaming pattern.
export const instant = false;

export default async function AdminPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    redirect("/dashboard");
  }

  return (
    <main className="p-6">
      <h1 className="text-xl font-semibold">Admin Dashboard</h1>
      <p className="mt-2 text-sm text-gray-500">
        User/subscription/payment management আসবে পরের ফেজগুলোতে।
      </p>
    </main>
  );
}
