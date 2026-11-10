import { createClient } from "@/lib/supabase/server";
import { db } from "@/db/client";
import { profiles, plans } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { planStats } from "@/lib/plan/schema";
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
  const [active] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.userId, user.id), eq(plans.status, "active")));
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

      <main className="mx-auto w-full max-w-4xl p-4 sm:p-6">
        <h1 className="text-xl font-semibold">{dict.dashboard.question}</h1>
        <p className="mt-2 text-muted">
          {dict.dashboard.greeting}, {profile?.displayName ?? user.email}
        </p>
        {active ? (
          <Link
            href={`/planner/${active.id}`}
            className="mt-6 block rounded-xl border border-border bg-surface p-5 hover:border-accent"
          >
            <p className="text-xs text-success">চলমান প্ল্যান</p>
            <p className="mt-1 text-lg font-semibold">{active.title}</p>
            <p className="mt-1 text-sm text-muted">
              {active.planData.subjects.length} বিষয় · শেষ {planStats(active.planData).endDate}
            </p>
          </Link>
        ) : (
          <div className="mt-6 rounded-xl border border-border bg-surface p-6 text-center text-muted">
            <p>{dict.dashboard.noPlan}</p>
            <p className="mt-1 text-sm">{dict.dashboard.noPlanHint}</p>
            <Link
              href="/planner"
              className="mt-4 inline-block rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground"
            >
              প্ল্যান বানান
            </Link>
          </div>
        )}
      </main>
    </AppShell>
  );
}
