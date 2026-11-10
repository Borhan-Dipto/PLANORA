import Link from "next/link";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { getActivePlan, todayFor } from "@/lib/schedule/service";
import { cycleEnd } from "@/lib/schedule/engine";
import { addDays } from "@/lib/plan/schema";
import { PageFrame } from "@/components/page-frame";
import { DayPlanner } from "@/components/schedule/day-planner";
import { ui, WEEKDAY_LABEL } from "@/components/ui";

export default async function DayPlannerPage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const userId = await requireUserId();
  const today = await todayFor(userId);
  const active = await getActivePlan(userId, today);

  if (!active) {
    return (
      <PageFrame title="দিনের সময় ঠিক করুন" back="/dashboard">
        <div className={`${ui.card} text-center text-muted`}>
          <p>আগে একটা চলমান প্ল্যান দরকার।</p>
          <Link href="/planner" className={`${ui.btn} ${ui.primary} mt-4`}>
            প্ল্যান বানান
          </Link>
        </div>
      </PageFrame>
    );
  }

  const plan = active.planData;
  const tomorrow = addDays(today, 1);
  const { d } = await searchParams;
  const date = d === "tomorrow" ? tomorrow : today;

  if (date < plan.startDate || date > cycleEnd(plan)) {
    return (
      <PageFrame title="দিনের সময় ঠিক করুন" back="/dashboard">
        <div className={`${ui.card} text-center text-muted`}>
          <p>এই তারিখ প্ল্যানের বাইরে।</p>
        </div>
      </PageFrame>
    );
  }

  const tasks = await db
    .select()
    .from(planTasks)
    .where(
      and(eq(planTasks.planId, active.id), eq(planTasks.date, date), inArray(planTasks.kind, ["study", "revision"]))
    );

  const initialMinutes: Record<string, number> = {};
  for (const t of tasks) if (t.subjectId) initialMinutes[t.subjectId] = (initialMinutes[t.subjectId] ?? 0) + t.minutes;
  const locked = tasks.some((t) => t.locked);
  const subjects = plan.subjects.map((s) => ({ id: s.id, name: s.name }));
  const weekday = WEEKDAY_LABEL[new Date(date + "T00:00:00Z").getUTCDay()];
  const dateLabel = `${date === today ? "আজ" : "আগামীকাল"} · ${weekday}, ${date.slice(5)}`;

  return (
    <PageFrame title="দিনের সময় ঠিক করুন" back="/dashboard">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Link
            href="/planner/day"
            className={`${ui.btn} ${date === today ? ui.primary : ui.secondary}`}
          >
            আজ
          </Link>
          <Link
            href="/planner/day?d=tomorrow"
            className={`${ui.btn} ${date === tomorrow ? ui.primary : ui.secondary}`}
          >
            আগামীকাল
          </Link>
        </div>

        <p className="text-xs text-muted">
          প্রতিদিন আপনার ক্লাস রুটিন ভিন্ন হতে পারে — তাই চাইলে প্রতিটা বিষয়ে সময় নিজে ঠিক করুন, অথবা কিছু না করলে
          অটোমেটিক সিস্টেম নিজেই সময় ভাগ করে দেবে।
        </p>

        <DayPlanner
          planId={active.id}
          date={date}
          dateLabel={dateLabel}
          subjects={subjects}
          initialMinutes={initialMinutes}
          locked={locked}
          dailyStudyMinutes={plan.dailyStudyMinutes}
        />
      </div>
    </PageFrame>
  );
}
