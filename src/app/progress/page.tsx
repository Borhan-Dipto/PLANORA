import Link from "next/link";
import { and, eq, inArray, lte, desc, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { getActivePlan, missedCount, todayFor } from "@/lib/schedule/service";
import { cycleEnd } from "@/lib/schedule/engine";
import { PageFrame } from "@/components/page-frame";
import { ui, fmtMinutes } from "@/components/ui";

function dayNumber(start: string, today: string) {
  return Math.round((Date.parse(today) - Date.parse(start)) / 86_400_000) + 1;
}
function daysUntil(today: string, date: string) {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
}

function Bar({ percent }: { percent: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-background">
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.min(100, percent)}%` }} />
    </div>
  );
}

export default async function ProgressPage() {
  const userId = await requireUserId();
  const today = await todayFor(userId);
  const active = await getActivePlan(userId, today);

  if (!active) {
    return (
      <PageFrame title="অগ্রগতি">
        <div className={`${ui.card} text-center text-muted`}>
          <p>অগ্রগতি দেখতে আগে একটা চলমান প্ল্যান দরকার।</p>
          <Link href="/planner" className={`${ui.btn} ${ui.primary} mt-4`}>
            প্ল্যান বানান
          </Link>
        </div>
      </PageFrame>
    );
  }

  const plan = active.planData;

  const [subjectRows, [study], [revision], dayRows, missed] = await Promise.all([
    db
      .select({
        subjectId: planTasks.subjectId,
        total: sql<number>`coalesce(sum(${planTasks.minutes}),0)::int`,
        done: sql<number>`coalesce(sum(${planTasks.minutes}) filter (where ${planTasks.status} = 'done'),0)::int`,
      })
      .from(planTasks)
      .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "study")))
      .groupBy(planTasks.subjectId),
    db
      .select({
        total: sql<number>`coalesce(sum(${planTasks.minutes}),0)::int`,
        done: sql<number>`coalesce(sum(${planTasks.minutes}) filter (where ${planTasks.status} = 'done'),0)::int`,
      })
      .from(planTasks)
      .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "study"))),
    db
      .select({
        total: sql<number>`coalesce(sum(${planTasks.minutes}),0)::int`,
        done: sql<number>`coalesce(sum(${planTasks.minutes}) filter (where ${planTasks.status} = 'done'),0)::int`,
      })
      .from(planTasks)
      .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "revision"))),
    db
      .select({
        date: planTasks.date,
        total: sql<number>`count(*)::int`,
        done: sql<number>`count(*) filter (where ${planTasks.status} = 'done')::int`,
      })
      .from(planTasks)
      .where(and(eq(planTasks.planId, active.id), inArray(planTasks.kind, ["study", "habit", "revision"]), lte(planTasks.date, today)))
      .groupBy(planTasks.date)
      .orderBy(desc(planTasks.date)),
    missedCount(active.id, today),
  ]);

  const bySubject = new Map(subjectRows.map((r) => [r.subjectId, r]));

  let streak = 0;
  for (const row of dayRows) {
    if (row.date === today && row.done < row.total) continue; // today not finished yet — doesn't break or count
    if (row.total > 0 && row.done === row.total) streak++;
    else break;
  }

  const overallPercent = study.total ? Math.round((study.done / study.total) * 100) : 0;
  const revisionStarted = today > cycleEnd(plan) || revision.total > 0;
  const dayNo = dayNumber(plan.startDate, today);
  const totalDays = plan.learningDays + plan.revisionDays;
  const examLeft = plan.examDate ? daysUntil(today, plan.examDate) : null;

  return (
    <PageFrame title="অগ্রগতি">
      <div className="space-y-4">
        <div className={ui.card}>
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold">সার্বিক অগ্রগতি (লার্নিং)</span>
            <span className="text-muted">
              {overallPercent}% · {fmtMinutes(study.done)} / {fmtMinutes(study.total)}
            </span>
          </div>
          <div className="mt-2">
            <Bar percent={overallPercent} />
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            <span>দিন {Math.max(1, Math.min(dayNo, totalDays))}/{totalDays}</span>
            {examLeft !== null && <span>{examLeft >= 0 ? `পরীক্ষার বাকি ${examLeft} দিন` : "পরীক্ষা শেষ"}</span>}
            {missed > 0 && (
              <Link href="/dashboard" className="text-error">
                মিস করা টাস্ক {missed}টি →
              </Link>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className={ui.card}>
            <p className="text-xs text-muted">🔥 ধারাবাহিক দিন (স্ট্রিক)</p>
            <p className="mt-1 text-2xl font-semibold">{streak}</p>
          </div>
          <div className={ui.card}>
            <p className="text-xs text-muted">🔁 রিভিশন অগ্রগতি</p>
            <p className="mt-1 text-2xl font-semibold">{revision.total ? Math.round((revision.done / revision.total) * 100) : 0}%</p>
          </div>
        </div>

        <div className={ui.card}>
          <h2 className="mb-3 font-semibold">বিষয়ভিত্তিক অগ্রগতি</h2>
          <div className="space-y-4">
            {plan.subjects.map((s) => {
              const r = bySubject.get(s.id);
              const total = r?.total ?? 0;
              const done = r?.done ?? 0;
              const percent = total ? Math.round((done / total) * 100) : 0;
              return (
                <div key={s.id}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted">
                      {percent}% · {fmtMinutes(done)} / {fmtMinutes(total)}
                    </span>
                  </div>
                  <Bar percent={percent} />
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <Link href="/revision" className="text-accent">
            রিভিশন দেখুন →
          </Link>
          <Link href={`/planner/${active.id}/schedule`} className="text-accent">
            পুরো সময়সূচি দেখুন →
          </Link>
        </div>
        {!revisionStarted && (
          <p className="text-center text-xs text-muted">লার্নিং সাইকেল শেষ হলে রিভিশন অগ্রগতি এখানে যোগ হবে।</p>
        )}
      </div>
    </PageFrame>
  );
}
