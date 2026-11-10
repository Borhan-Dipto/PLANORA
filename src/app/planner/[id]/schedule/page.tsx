import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/db/client";
import { plans, planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { addDays } from "@/lib/plan/schema";
import { buildRevisionTasks, buildSchedule, cycleEnd, learningEnd } from "@/lib/schedule/engine";
import { missedCount, todayFor } from "@/lib/schedule/service";
import { PageFrame } from "@/components/page-frame";
import { CalendarSchedule } from "@/components/schedule/calendar-schedule";
import { TaskList, type TaskItem } from "@/components/schedule/task-list";
import { RescheduleBanner } from "@/components/schedule/reschedule-button";
import { ui, fmtMinutes, WEEKDAY_LABEL } from "@/components/ui";

export default async function SchedulePage({ params }: PageProps<"/planner/[id]/schedule">) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, id), eq(plans.userId, userId)));
  if (!plan) notFound();

  const d = plan.planData;
  const today = await todayFor(userId);
  const isDraft = plan.status === "draft";
  const editable = plan.status === "active";

  const tasksByDate = new Map<string, TaskItem[]>();

  if (isDraft) {
    // Nothing is saved yet — compute exactly what the engine WOULD schedule, from the plan's own
    // data, so the user can check it day by day before approving. Nothing is persisted here.
    const { tasks } = buildSchedule(d, d.startDate);
    for (const t of [...tasks, ...buildRevisionTasks(d, d.startDate)]) {
      const item: TaskItem = {
        id: `preview-${t.date}-${t.sort}`,
        kind: t.kind,
        title: t.title,
        subjectName: t.subjectName,
        minutes: t.minutes,
        part: t.part,
        parts: t.parts,
        status: "pending",
      };
      tasksByDate.set(t.date, [...(tasksByDate.get(t.date) ?? []), item]);
    }

    return (
      <PageFrame
        title={`সময়সূচি প্রিভিউ — ${plan.title}`}
        back={`/planner/${id}`}
        actions={
          <Link href={`/planner/${id}/edit`} className={`${ui.btn} ${ui.secondary} px-3 py-1.5`}>
            ✎ এডিট
          </Link>
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-muted">
            এটা এখনো সেভ/অনুমোদন হয়নি — শুধু প্রিভিউ। কোনো দিনের টপিক দেখে অসঙ্গতি লাগলে এডিট পেজ থেকে সাবজেক্ট/টপিকের ক্রম, গুরুত্ব বা সময় বদলে
            আবার এখানে চেক করুন।
          </p>
          <CalendarSchedule
            tasksByDate={Object.fromEntries(tasksByDate)}
            startDate={d.startDate}
            endDate={cycleEnd(d)}
            today={today}
            editable={false}
          />
        </div>
      </PageFrame>
    );
  }

  const rows = await db.select().from(planTasks).where(eq(planTasks.planId, id)).orderBy(planTasks.date, planTasks.sort);
  for (const r of rows) tasksByDate.set(r.date, [...(tasksByDate.get(r.date) ?? []), r]);
  const missed = plan.status === "active" ? await missedCount(id, today) : 0;

  const lEnd = learningEnd(d);
  const cEnd = cycleEnd(d);
  const groups: { label: string; dates: string[] }[] = [];
  for (let i = 0, date = d.startDate; date <= cEnd; i++, date = addDays(date, 1)) {
    const label = date > lEnd ? "রিভিশন" : `সপ্তাহ ${Math.floor(i / 7) + 1}`;
    if (groups.at(-1)?.label !== label) groups.push({ label, dates: [] });
    groups.at(-1)!.dates.push(date);
  }

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

        <CalendarSchedule
          tasksByDate={Object.fromEntries(tasksByDate)}
          startDate={d.startDate}
          endDate={cEnd}
          today={today}
          editable={editable}
        />

        {groups.map((g) => {
          const isCurrent = g.dates.includes(today) || (today < d.startDate && g === groups[0]);
          const mins = g.dates.flatMap((x) => tasksByDate.get(x) ?? []).filter((t) => t.kind === "study" || t.kind === "revision");
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
                  const items = tasksByDate.get(date) ?? [];
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
                        <p className="text-xs text-muted">বিশ্রাম / কোনো পড়া নেই</p>
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
