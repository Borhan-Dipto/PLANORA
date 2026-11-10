import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { getActivePlan, todayFor } from "@/lib/schedule/service";
import { PageFrame } from "@/components/page-frame";
import { ui, fmtMinutes, DIFFICULTY_LABEL, WEEKDAY_LABEL } from "@/components/ui";

export default async function SubjectsPage() {
  const userId = await requireUserId();
  const today = await todayFor(userId);
  const active = await getActivePlan(userId, today);

  if (!active) {
    return (
      <PageFrame title="বিষয়">
        <div className={`${ui.card} text-center text-muted`}>
          <p>বিষয় দেখতে আগে একটা চলমান প্ল্যান দরকার।</p>
          <Link href="/planner" className={`${ui.btn} ${ui.primary} mt-4`}>
            প্ল্যান বানান
          </Link>
        </div>
      </PageFrame>
    );
  }

  const plan = active.planData;

  const doneRows = await db
    .select({
      topicId: planTasks.topicId,
      done: sql<number>`coalesce(sum(${planTasks.minutes}) filter (where ${planTasks.status} = 'done'),0)::int`,
    })
    .from(planTasks)
    .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "study")))
    .groupBy(planTasks.topicId);
  const doneByTopic = new Map(doneRows.map((r) => [r.topicId, r.done]));

  return (
    <PageFrame
      title="বিষয়"
      actions={
        <Link href={`/planner/${active.id}/edit`} className="shrink-0 text-xs text-accent">
          ✎ এডিট করুন
        </Link>
      }
    >
      <div className="space-y-4">
        {plan.subjects.map((s) => {
          const subjectTotal = s.topics.reduce((n, t) => n + t.estimatedMinutes, 0);
          const subjectDone = s.topics.reduce((n, t) => n + Math.min(t.estimatedMinutes, doneByTopic.get(t.id) ?? 0), 0);
          const percent = subjectTotal ? Math.round((subjectDone / subjectTotal) * 100) : 0;
          const days = s.weekdays ?? [];
          return (
            <section key={s.id} className={ui.card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <h2 className="truncate font-semibold">{s.name}</h2>
                  {s.course && <p className="truncate text-xs text-muted">{s.course}</p>}
                </div>
                <span className="shrink-0 text-xs text-muted">
                  {percent}% · {fmtMinutes(subjectDone)} / {fmtMinutes(subjectTotal)}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${percent}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {days.length ? days.map((d) => WEEKDAY_LABEL[d]).join(", ") : "প্রতিদিন"} · প্রায়োরিটি {s.priority}
              </p>

              <ul className="mt-3 divide-y divide-border border-t border-border">
                {s.topics.map((t) => {
                  const done = Math.min(t.estimatedMinutes, doneByTopic.get(t.id) ?? 0);
                  const tp = t.estimatedMinutes ? Math.round((done / t.estimatedMinutes) * 100) : 0;
                  return (
                    <li key={t.id} className="flex items-center gap-3 py-2 text-sm">
                      <span
                        className={`shrink-0 text-xs ${done >= t.estimatedMinutes ? "text-success" : "text-muted"}`}
                        aria-hidden
                      >
                        {done >= t.estimatedMinutes ? "✓" : "○"}
                      </span>
                      <span className="min-w-0 flex-1 truncate">{t.name}</span>
                      <span className="shrink-0 text-xs text-muted">{DIFFICULTY_LABEL[t.difficulty]}</span>
                      <span className="shrink-0 text-xs text-muted">{fmtMinutes(t.estimatedMinutes)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {!plan.subjects.length && <p className="text-center text-sm text-muted">এই প্ল্যানে কোনো বিষয় নেই।</p>}
      </div>
    </PageFrame>
  );
}
