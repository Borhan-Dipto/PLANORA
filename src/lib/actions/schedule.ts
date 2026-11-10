"use server";

import { and, eq, inArray } from "drizzle-orm";
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
 * Manually fix one day's (today or tomorrow's) study plan topic-by-topic — for when real class
 * durations are only known that morning or the night before, and the user needs to see and pick
 * exactly which topic each block of time goes to. Replaces that day's pending study/revision
 * tasks with the given topic+minutes choices and locks them so the automatic engine never
 * touches that day again.
 */
export async function planMyDay(
  planId: string,
  date: string,
  allocations: { subjectId: string; topicId: string; minutes: number }[]
) {
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
  if (date < data.startDate || date > cycleEnd(data)) return { ok: false as const, error: "এই তারিখ প্ল্যানের বাইরে" };

  const cleanAllocs = allocations.filter((a) => Number.isFinite(a.minutes) && a.minutes > 0);
  if (!cleanAllocs.length) return { ok: false as const, error: "অন্তত একটা টপিকের জন্য সময় দিন" };

  const newTasks: (typeof planTasks.$inferInsert)[] = [];
  let sort = 0;
  for (const alloc of cleanAllocs) {
    const subject = data.subjects.find((s) => s.id === alloc.subjectId);
    const topic = subject?.topics.find((t) => t.id === alloc.topicId);
    if (!subject || !topic) continue;
    newTasks.push({
      planId,
      userId,
      date,
      kind,
      subjectId: subject.id,
      topicId: topic.id,
      subjectName: subject.name,
      title: topic.name,
      minutes: round5(alloc.minutes),
      part: 1,
      parts: 1,
      sort: sort++,
      locked: true,
    });
  }
  if (!newTasks.length) return { ok: false as const, error: "এই টপিকগুলো প্ল্যানে পাওয়া যায়নি" };

  await db.transaction(async (tx) => {
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
    await tx.insert(planTasks).values(newTasks);
  });
  // Rebalance every other day around the newly fixed one: topics the user pulled into this day
  // must not also appear later, and anything the auto-engine had put here that the user dropped
  // must move to another day instead of silently disappearing.
  await regenerateSchedule(planId, userId, data, today);

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
