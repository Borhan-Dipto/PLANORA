"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { plans, planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { regenerateSchedule, todayFor } from "@/lib/schedule/service";
import { learningEnd, cycleEnd, round5 } from "@/lib/schedule/engine";
import { addDays } from "@/lib/plan/schema";

export async function setTaskDone(taskId: string, done: boolean) {
  const userId = await requireUserId();
  await db
    .update(planTasks)
    .set({ status: done ? "done" : "pending", completedAt: done ? new Date() : null })
    .where(and(eq(planTasks.id, taskId), eq(planTasks.userId, userId)));
  revalidatePath("/dashboard");
  return { ok: true as const };
}

/** "I fell behind" — spread every missed study task over the remaining days from today. */
export async function rescheduleMissed(planId: string) {
  const userId = await requireUserId();
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.userId, userId), eq(plans.status, "active")));
  if (!plan) return { ok: false as const, error: "চলমান প্ল্যান পাওয়া যায়নি" };
  await regenerateSchedule(plan.id, userId, plan.planData, await todayFor(userId));
  revalidatePath("/dashboard");
  revalidatePath(`/planner/${planId}/schedule`);
  return { ok: true as const };
}

/**
 * Manually fix one day's (today or tomorrow's) per-subject study minutes — for when real class
 * durations are only known that morning or the night before. Replaces that day's pending study/
 * revision tasks with ones built from the given minutes, picking topics in each subject's own
 * order and locking the result so the automatic engine never touches that day again.
 */
export async function planMyDay(planId: string, date: string, allocations: { subjectId: string; minutes: number }[]) {
  const userId = await requireUserId();
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.userId, userId), eq(plans.status, "active")));
  if (!plan) return { ok: false as const, error: "চলমান প্ল্যান পাওয়া যায়নি" };

  const today = await todayFor(userId);
  const tomorrow = addDays(today, 1);
  if (date !== today && date !== tomorrow) return { ok: false as const, error: "শুধু আজ বা আগামীকালের জন্য সময় ঠিক করা যায়" };

  const data = plan.planData;
  const kind: "study" | "revision" = date <= learningEnd(data) ? "study" : "revision";
  if (date > cycleEnd(data)) return { ok: false as const, error: "এই তারিখ প্ল্যানের বাইরে" };

  const cleanAllocs = allocations.filter((a) => Number.isFinite(a.minutes) && a.minutes > 0);
  if (!cleanAllocs.length) return { ok: false as const, error: "অন্তত একটা বিষয়ের জন্য সময় দিন" };

  await db.transaction(async (tx) => {
    // Minutes already spoken for elsewhere (done, or locked on a different day) — this day's own
    // old rows don't count, since we're about to replace them.
    const spoken = await tx
      .select({ topicId: planTasks.topicId, minutes: sql<number>`sum(${planTasks.minutes})::int` })
      .from(planTasks)
      .where(
        and(
          eq(planTasks.planId, planId),
          inArray(planTasks.kind, ["study", "revision"]),
          sql`(${planTasks.status} = 'done' or (${planTasks.locked} = true and ${planTasks.date} <> ${date}))`
        )
      )
      .groupBy(planTasks.topicId);
    const spokenBy = new Map(spoken.map((d) => [d.topicId, d.minutes]));

    await tx
      .delete(planTasks)
      .where(
        and(
          eq(planTasks.planId, planId),
          eq(planTasks.date, date),
          inArray(planTasks.kind, ["study", "revision"]),
          eq(planTasks.status, "pending")
        )
      );

    const newTasks: (typeof planTasks.$inferInsert)[] = [];
    let sort = 0;
    for (const alloc of cleanAllocs) {
      const subject = data.subjects.find((s) => s.id === alloc.subjectId);
      if (!subject) continue;
      let budget = alloc.minutes;
      const chunks: { topicId: string; title: string; minutes: number }[] = [];
      for (const topic of subject.topics) {
        if (budget <= 0) break;
        const left = topic.estimatedMinutes - (spokenBy.get(topic.id) ?? 0);
        if (left < 15) continue; // tiny leftovers count as finished
        const take = Math.min(left, budget);
        chunks.push({ topicId: topic.id, title: topic.name, minutes: round5(take) });
        budget -= take;
      }
      chunks.forEach((c, i) =>
        newTasks.push({
          planId,
          userId,
          date,
          kind,
          subjectId: subject.id,
          topicId: c.topicId,
          subjectName: subject.name,
          title: c.title,
          minutes: c.minutes,
          part: i + 1,
          parts: chunks.length,
          sort: sort++,
          locked: true,
        })
      );
    }
    if (newTasks.length) await tx.insert(planTasks).values(newTasks);
  });

  revalidatePath("/dashboard");
  revalidatePath(`/planner/${planId}/schedule`);
  revalidatePath("/planner/day");
  return { ok: true as const };
}

/** Un-fix a manually planned day — removes its locked tasks and lets the automatic engine take it back over. */
export async function unlockDay(planId: string, date: string) {
  const userId = await requireUserId();
  const [plan] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.userId, userId), eq(plans.status, "active")));
  if (!plan) return { ok: false as const, error: "চলমান প্ল্যান পাওয়া যায়নি" };

  await db
    .delete(planTasks)
    .where(
      and(
        eq(planTasks.planId, planId),
        eq(planTasks.date, date),
        inArray(planTasks.kind, ["study", "revision"]),
        eq(planTasks.locked, true),
        eq(planTasks.status, "pending")
      )
    );

  const today = await todayFor(userId);
  await regenerateSchedule(planId, userId, plan.planData, date < today ? today : date);
  revalidatePath("/dashboard");
  revalidatePath(`/planner/${planId}/schedule`);
  revalidatePath("/planner/day");
  return { ok: true as const };
}
