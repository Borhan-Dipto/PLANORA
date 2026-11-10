import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { profiles, planTasks, userPreferences } from "@/db/schema";
import { signOut } from "@/lib/actions/auth";
import { requireUserId } from "@/lib/session";
import { getDictionary, getLocale } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { getActivePlan, missedCount, tasksForDates, todayFor } from "@/lib/schedule/service";
import { cycleEnd, learningEnd } from "@/lib/schedule/engine";
import { addDays } from "@/lib/plan/schema";
import { TaskList } from "@/components/schedule/task-list";
import { getActiveFocusSession } from "@/lib/actions/focus";
import { RescheduleBanner } from "@/components/schedule/reschedule-button";
import { LiveTimeBudget } from "@/components/schedule/live-time-budget";
import { LiveClock } from "@/components/live-clock";
import { ui, fmtMinutes } from "@/components/ui";

export const instant = false;

function dayNumber(start: string, today: string) {
  return Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1;
}

export default async function DashboardPage() {
  const userId = await requireUserId();
  const today = await todayFor(userId);
  const [[profile], [prefs], dict, locale, active, focusSession] = await Promise.all([
    db.select().from(profiles).where(eq(profiles.id, userId)),
    db.select().from(userPreferences).where(eq(userPreferences.userId, userId)),
    getDictionary(),
    getLocale(),
    getActivePlan(userId, today),
    getActiveFocusSession(),
  ]);

  let body: React.ReactNode;
  if (!active) {
    body = (
      <div className="mt-6 space-y-4">
        <LiveClock className={ui.card} />
        <div className={`${ui.card} text-center text-muted`}>
          <p>{dict.dashboard.noPlan}</p>
          <p className="mt-1 text-sm">{dict.dashboard.noPlanHint}</p>
          <Link href="/planner" className={`${ui.btn} ${ui.primary} mt-4`}>
            প্ল্যান বানান
          </Link>
        </div>
      </div>
    );
  } else {
    const plan = active.planData;
    const [tasks, missed, [progress]] = await Promise.all([
      tasksForDates(active.id, [today]),
      missedCount(active.id, today),
      db
        .select({
          total: sql<number>`coalesce(sum(${planTasks.minutes}),0)::int`,
          done: sql<number>`coalesce(sum(${planTasks.minutes}) filter (where ${planTasks.status} = 'done'),0)::int`,
        })
        .from(planTasks)
        .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "study"))),
    ]);
    const study = tasks.filter((t) => t.kind === "study");
    const todayMin = study.reduce((n, t) => n + t.minutes, 0);
    const todayDone = study.filter((t) => t.status === "done").reduce((n, t) => n + t.minutes, 0);
    const overall = progress.total ? Math.round((progress.done / progress.total) * 100) : 0;
    const dayNo = dayNumber(plan.startDate, today);
    const totalDays = plan.learningDays + plan.revisionDays;
    const notStarted = today < plan.startDate;
    const isRevision = today > learningEnd(plan) && today <= cycleEnd(plan);

    body = (
      <div className="mt-6 space-y-4">
        <LiveClock className={ui.card} />
        <Link href={`/planner/${active.id}`} className={`${ui.card} block hover:border-accent`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 truncate font-semibold">{active.title}</p>
            <span className="text-xs text-muted">
              {notStarted ? `শুরু ${plan.startDate}` : `দিন ${dayNo}/${totalDays}`}
            </span>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${overall}%` }} />
          </div>
          <p className="mt-1.5 text-xs text-muted">
            মোট অগ্রগতি {overall}% · {fmtMinutes(progress.done)} / {fmtMinutes(progress.total)}
          </p>
        </Link>

        {focusSession && (
          <Link
            href="/focus"
            className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent/10 p-4 hover:border-accent"
          >
            <span className="text-2xl">▶</span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">ফোকাস মোড চলছে: {focusSession.title}</span>
              <span className="block text-xs text-muted">ফিরে গিয়ে চালিয়ে যান — সময় গণনা চলছেই</span>
            </span>
          </Link>
        )}

        <RescheduleBanner planId={active.id} missed={missed} />

        {!notStarted && todayMin > 0 && (
          <LiveTimeBudget
            wakeTime={prefs?.wakeTime ?? null}
            sleepTime={prefs?.sleepTime ?? null}
            studyRemainingMinutes={todayMin - todayDone}
          />
        )}

        <section className={ui.card}>
          <h2 className="mb-3 font-semibold">আজকের পড়ার তালিকা</h2>
          {notStarted ? (
            <p className="text-sm text-muted">প্ল্যান শুরু হবে {plan.startDate} তারিখে। প্রস্তুত থাকুন! 💪</p>
          ) : isRevision && !study.length ? (
            <p className="text-sm text-muted">🔁 আজ রিভিশনের দিন — আগের কঠিন টপিকগুলো আবার দেখে নিন।</p>
          ) : tasks.length ? (
            <TaskList tasks={tasks} showFocusStart />
          ) : (
            <p className="text-sm text-muted">আজ কোনো পড়া নির্ধারিত নেই — বিশ্রাম নিন 🌿</p>
          )}
          <Link href={`/planner/${active.id}/schedule`} className="mt-4 inline-block text-sm text-accent">
            পুরো সময়সূচি দেখুন →
          </Link>
        </section>

        {!notStarted && today < cycleEnd(plan) && (
          <TomorrowPreview planId={active.id} date={addDays(today, 1)} />
        )}
      </div>
    );
  }

  return (
    <AppShell dict={dict} locale={locale}>
      <header className="flex items-center justify-between border-b border-border p-4">
        <Link href="/dashboard" className="font-semibold text-accent">
          PLANORA
        </Link>
        <form action={signOut}>
          <button className="rounded-md border border-border px-3 py-1.5 text-sm text-muted hover:text-foreground">
            {dict.auth.logout}
          </button>
        </form>
      </header>
      <main className="mx-auto w-full max-w-3xl p-4 sm:p-6">
        <h1 className="text-xl font-semibold">{dict.dashboard.question}</h1>
        <p className="mt-1 text-sm text-muted">
          {dict.dashboard.greeting}, {profile?.displayName ?? profile?.email}
        </p>
        {body}
      </main>
    </AppShell>
  );
}

async function TomorrowPreview({ planId, date }: { planId: string; date: string }) {
  const tasks = (await tasksForDates(planId, [date])).filter((t) => t.kind === "study");
  if (!tasks.length) return null;
  return (
    <section className={ui.card}>
      <h2 className="mb-2 text-sm font-semibold text-muted">আগামীকাল</h2>
      <ul className="space-y-1 text-sm">
        {tasks.map((t) => (
          <li key={t.id} className="flex gap-2">
            <span className="min-w-0 flex-1 truncate">{t.title}</span>
            <span className="shrink-0 text-xs text-muted">{fmtMinutes(t.minutes)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
