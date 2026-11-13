import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db/client";
import { planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { getActivePlan, todayFor } from "@/lib/schedule/service";
import { learningEnd } from "@/lib/schedule/engine";
import { PageFrame } from "@/components/page-frame";
import { TaskList, type TaskItem } from "@/components/schedule/task-list";
import { ui, WEEKDAY_LABEL } from "@/components/ui";

export default async function RevisionPage() {
  const userId = await requireUserId();
  const today = await todayFor(userId);
  const active = await getActivePlan(userId, today);
  if (!active) {
    return (
      <PageFrame title="রিভিশন">
        <div className={`${ui.card} text-center text-muted`}>
          <p>🔁 রিভিশন দেখতে আগে একটা চলমান প্ল্যান দরকার।</p>
          <Link href="/planner" className={`${ui.btn} ${ui.primary} mt-4`}>
            প্ল্যান বানান
          </Link>
        </div>
      </PageFrame>
    );
  }

  const plan = active.planData;
  const lEnd = learningEnd(plan);

  if (today <= lEnd) {
    return (
      <PageFrame title="রিভিশন">
        <div className={`${ui.card} text-center text-muted`}>
          <p>🔁 রিভিশন শুরু হবে {addOneDay(lEnd)} তারিখে — আগে শেখার {plan.learningDays} দিন শেষ করুন।</p>
          <Link href="/dashboard" className={`${ui.btn} ${ui.primary} mt-4`}>
            আজকের পড়ায় ফিরুন
          </Link>
        </div>
      </PageFrame>
    );
  }

  const tasks = await db
    .select()
    .from(planTasks)
    .where(and(eq(planTasks.planId, active.id), eq(planTasks.kind, "revision")))
    .orderBy(planTasks.date, planTasks.sort);

  const byDate = new Map<string, TaskItem[]>();
  for (const t of tasks) byDate.set(t.date, [...(byDate.get(t.date) ?? []), t]);
  const dates = [...byDate.keys()].sort();

  const done = tasks.filter((t) => t.status === "done").reduce((n, t) => n + t.minutes, 0);
  const total = tasks.reduce((n, t) => n + t.minutes, 0);

  return (
    <PageFrame title="রিভিশন">
      <div className="space-y-4">
        <div className={ui.card}>
          <div className="flex items-center justify-between text-sm">
            <span>রিভিশন অগ্রগতি</span>
            <span className="text-muted">
              {total ? Math.round((done / total) * 100) : 0}% · {Math.round(done / 60)} / {Math.round(total / 60)} ঘণ্টা
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-muted">
            কঠিন ও গুরুত্বপূর্ণ টপিকগুলো আগে রাখা হয়েছে — পরীক্ষার আগে যতটা সময় বাকি তার মধ্যেই।
          </p>
        </div>

        {!tasks.length ? (
          <div className={`${ui.card} text-center text-muted`}>
            <p>এই প্ল্যানের কোনো টপিকের জন্য রিভিশন তৈরি হয়নি।</p>
            <p className="mt-1 text-xs">প্ল্যান এডিট করে একবার সেভ করলে রিভিশন সময়সূচি নতুন করে তৈরি হবে।</p>
          </div>
        ) : (
          dates.map((date) => {
            const items = byDate.get(date)!;
            const isToday = date === today;
            return (
              <section key={date} id={isToday ? "today" : undefined} className={ui.card}>
                <h2 className={`mb-3 text-sm font-semibold ${isToday ? "text-accent" : ""}`}>
                  {WEEKDAY_LABEL[new Date(date + "T00:00:00Z").getUTCDay()]}, {date.slice(5)}
                  {isToday && " · আজ"}
                </h2>
                <TaskList tasks={items} readOnly={date > today} showFocusStart={isToday} />
              </section>
            );
          })
        )}

        <p className="text-center text-xs text-muted">সম্পূর্ণ সময়সূচি দেখতে — </p>
        <Link href={`/planner/${active.id}/schedule`} className="block text-center text-sm text-accent">
          পুরো সময়সূচি দেখুন →
        </Link>
      </div>
    </PageFrame>
  );
}

function addOneDay(date: string) {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
