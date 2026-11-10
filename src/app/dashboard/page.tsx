import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { profiles } from "@/db/schema";
import { eq } from "drizzle-orm";
import { signOut } from "@/lib/actions/auth";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";

export const instant = false;

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile] = await db.select().from(profiles).where(eq(profiles.id, user.id));
  const dict = await getDictionary();
  const locale = await getLocale();

  return (
    <AppShell dict={dict} locale={locale}>
      <header className="flex items-center justify-between border-b border-border p-4">
        <span className="font-semibold text-accent">PLANORA</span>
        <form action={signOut}>
          <button className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground">
            {dict.auth.logout}
          </button>
        </form>
      </header>

      <main className="p-6">
        <h1 className="text-xl font-semibold">{dict.dashboard.question}</h1>
        <p className="mt-2 text-muted">
          {dict.dashboard.greeting}, {profile?.displayName ?? user.email}
        </p>
        <div className="mt-6 rounded-lg border border-border bg-surface p-6 text-center text-muted">
          <p>{dict.dashboard.noPlan}</p>
          <p className="mt-1 text-sm">{dict.dashboard.noPlanHint}</p>
        </div>
      </main>
    </AppShell>
  );
}
