import Link from "next/link";
import { eq, and, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { getActivePlan, todayFor } from "@/lib/schedule/service";
import { cycleEnd } from "@/lib/schedule/engine";
import { addDays } from "@/lib/plan/schema";
import { PageFrame } from "@/components/page-frame";
import { DayPlanner, type SubjectWithTopics } from "@/components/schedule/day-planner";
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

  // Minutes already "spoken for" per topic elsewhere (done, or locked on a different day) — this
  // date's own existing tasks don't count, since the user is about to re-pick them below.
  const spoken = await db
    .select({ topicId: planTasks.topicId, minutes: sql<number>`sum(${planTasks.minutes})::int` })
    .from(planTasks)
    .where(
      and(
        eq(planTasks.planId, active.id),
        inArray(planTasks.kind, ["study", "revision"]),
        sql`(${planTasks.status} = 'done' or (${planTasks.locked} = true and ${planTasks.date} <> ${date}))`
      )
    )
    .groupBy(planTasks.topicId);
  const spokenBy = new Map(spoken.map((s) => [s.topicId, s.minutes]));

  const tasks = await db
    .select()
    .from(planTasks)
    .where(
      and(eq(planTasks.planId, active.id), eq(planTasks.date, date), inArray(planTasks.kind, ["study", "revision"]))
    );
  const initialMinutes: Record<string, number> = {};
  for (const t of tasks) if (t.topicId) initialMinutes[t.topicId] = (initialMinutes[t.topicId] ?? 0) + t.minutes;
  const locked = tasks.some((t) => t.locked);

  // Only topics with real time left matter here — a topic already finished has nothing to pick today.
  const subjects: SubjectWithTopics[] = plan.subjects
    .map((s) => ({
      id: s.id,
      name: s.name,
      topics: s.topics
        .map((t) => ({
          id: t.id,
          name: t.name,
          difficulty: t.difficulty,
          remaining: Math.max(0, t.estimatedMinutes - (spokenBy.get(t.id) ?? 0)),
        }))
        .filter((t) => t.remaining >= 15 || (initialMinutes[t.id] ?? 0) > 0),
    }))
    .filter((s) => s.topics.length);

  const weekday = WEEKDAY_LABEL[new Date(date + "T00:00:00Z").getUTCDay()];
  const dateLabel = `${date === today ? "আজ" : "আগামীকাল"} · ${weekday}, ${date.slice(5)}`;

  return (
    <PageFrame title="দিনের সময় ঠিক করুন" back="/dashboard">
      <div className="space-y-4">
        <div className="flex gap-2">
          <Link href="/planner/day" className={`${ui.btn} ${date === today ? ui.primary : ui.secondary}`}>
            আজ
          </Link>
          <Link href="/planner/day?d=tomorrow" className={`${ui.btn} ${date === tomorrow ? ui.primary : ui.secondary}`}>
            আগামীকাল
          </Link>
        </div>

        <p className="text-xs text-muted">
          ক্লাস রুটিন দেখে আজ/আগামীকাল ঠিক কোন টপিক পড়বেন তা খুঁজে যোগ করুন ও সময় বসান — কিছু না করলে অটোমেটিক সিস্টেম
          নিজেই টপিক ও সময় ঠিক করে দেবে। (সব টপিক ও তাদের ডিফল্ট সময় একসাথে দেখে এডিট করতে চাইলে প্ল্যানের{" "}
          <Link href={`/planner/${active.id}/edit`} className="text-accent">
            এডিট পেজ
          </Link>
          ।)
        </p>

        <DayPlanner
          key={date}
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
