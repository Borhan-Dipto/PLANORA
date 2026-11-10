import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { plans, planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { addDays } from "@/lib/plan/schema";
import { cycleEnd, learningEnd } from "@/lib/schedule/engine";
import { missedCount, todayFor } from "@/lib/schedule/service";
import { PageFrame } from "@/components/page-frame";
import { TaskList, type TaskItem } from "@/components/schedule/task-list";
import { RescheduleBanner } from "@/components/schedule/reschedule-button";
import { ui, fmtMinutes, WEEKDAY_LABEL } from "@/components/ui";

export default async function SchedulePage({ params }: PageProps<"/planner/[id]/schedule">) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, id), eq(plans.userId, userId)));
  if (!plan || plan.status === "draft") notFound();

  const d = plan.planData;
  const [tasks, today] = await Promise.all([
    db.select().from(planTasks).where(eq(planTasks.planId, id)).orderBy(planTasks.date, planTasks.sort),
    todayFor(userId),
  ]);
  const missed = plan.status === "active" ? await missedCount(id, today) : 0;
  const byDate = new Map<string, TaskItem[]>();
  for (const t of tasks) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);

  const lEnd = learningEnd(d);
  const cEnd = cycleEnd(d);
  const groups: { label: string; dates: string[] }[] = [];
  for (let i = 0, date = d.startDate; date <= cEnd; i++, date = addDays(date, 1)) {
    const label = date > lEnd ? "রিভিশন" : `সপ্তাহ ${Math.floor(i / 7) + 1}`;
    if (groups.at(-1)?.label !== label) groups.push({ label, dates: [] });
    groups.at(-1)!.dates.push(date);
  }
  const editable = plan.status === "active";

  return (
    <PageFrame
      title={`সময়সূচি — ${plan.title}`}
      back={`/planner/${id}`}
      actions={
        editable ? (
          <Link href={`/planner/${id}/edit`} className={`${ui.btn} ${ui.secondary} px-3 py-1.5`}>
            ✎ এডিট
          </Link>
        ) : null
      }
    >
      <div className="space-y-4">
        {editable && <RescheduleBanner planId={id} missed={missed} />}
        {groups.map((g) => {
          const isCurrent = g.dates.includes(today) || (today < d.startDate && g === groups[0]);
          const mins = g.dates.flatMap((x) => byDate.get(x) ?? []).filter((t) => t.kind === "study");
          const done = mins.filter((t) => t.status === "done").reduce((n, t) => n + t.minutes, 0);
          const total = mins.reduce((n, t) => n + t.minutes, 0);
          return (
            <details key={g.label} open={isCurrent} className={`${ui.card} group p-0 sm:p-0`}>
              <summary className="flex cursor-pointer list-none items-center gap-2 p-4">
                <span className="text-muted transition group-open:rotate-90">▸</span>
                <span className="flex-1 font-semibold">{g.label}</span>
                <span className="text-xs text-muted">
                  {g.dates[0].slice(5)} – {g.dates.at(-1)!.slice(5)}
                  {total > 0 && ` · ${Math.round((done / total) * 100)}%`}
                </span>
              </summary>
              <div className="space-y-4 border-t border-border p-4">
                {g.dates.map((date) => {
                  const items = byDate.get(date) ?? [];
                  const dayMin = items.reduce((n, t) => n + t.minutes, 0);
                  const isToday = date === today;
                  const heavy = dayMin > d.dailyStudyMinutes * 1.15;
                  return (
                    <div key={date} id={isToday ? "today" : undefined}>
                      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
                        <span className={`font-medium ${isToday ? "text-accent" : ""}`}>
                          {WEEKDAY_LABEL[new Date(date + "T00:00:00Z").getUTCDay()]}, {date.slice(5)}
                          {isToday && " · আজ"}
                        </span>
                        {dayMin > 0 && (
                          <span className={`text-xs ${heavy ? "text-warning" : "text-muted"}`}>
                            {fmtMinutes(dayMin)}
                            {heavy && " ⚠️ বেশি চাপ"}
                          </span>
                        )}
                      </div>
                      {items.length ? (
                        <TaskList tasks={items} readOnly={!editable || date > today} />
                      ) : (
                        <p className="text-xs text-muted">
                          {date > lEnd ? "রিভিশন (Phase 6-এ স্বয়ংক্রিয় রিভিশন যোগ হবে)" : "বিশ্রাম / কোনো পড়া নেই"}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </PageFrame>
  );
}
