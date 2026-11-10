import "server-only";
import { and, eq, inArray, lt, gte, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { plans, planTasks, profiles } from "@/db/schema";
import type { PlanData } from "@/lib/plan/schema";
import { buildSchedule, cycleEnd } from "./engine";

/** Today's date (YYYY-MM-DD) in the user's timezone. */
export async function todayFor(userId: string) {
  const [p] = await db.select({ tz: profiles.timezone }).from(profiles).where(eq(profiles.id, userId));
  return todayInTz(p?.tz || "Asia/Dhaka");
}

export function todayInTz(tz: string) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
  }
}

/**
 * (Re)builds the schedule from `from` onward. Completed work is kept; every pending study task
 * (including missed ones in the past) is redistributed over the remaining days, and future habits are regenerated.
 */
export async function regenerateSchedule(planId: string, userId: string, plan: PlanData, from: string) {
  await db.transaction(async (tx) => {
    const done = await tx
      .select({ topicId: planTasks.topicId, minutes: sql<number>`sum(${planTasks.minutes})::int` })
      .from(planTasks)
      .where(and(eq(planTasks.planId, planId), eq(planTasks.kind, "study"), eq(planTasks.status, "done")))
      .groupBy(planTasks.topicId);
    const doneBy = new Map(done.map((d) => [d.topicId, d.minutes]));

    const remaining = new Map<string, number>();
    for (const s of plan.subjects)
      for (const t of s.topics) {
        const left = t.estimatedMinutes - (doneBy.get(t.id) ?? 0);
        remaining.set(t.id, left < 15 ? 0 : left); // tiny leftovers count as finished
      }

    await tx
      .delete(planTasks)
      .where(and(eq(planTasks.planId, planId), eq(planTasks.kind, "study"), eq(planTasks.status, "pending")));
    await tx
      .delete(planTasks)
      .where(
        and(eq(planTasks.planId, planId), eq(planTasks.kind, "habit"), eq(planTasks.status, "pending"), gte(planTasks.date, from))
      );

    const { tasks } = buildSchedule(plan, from, remaining);
    for (let i = 0; i < tasks.length; i += 500) {
      await tx.insert(planTasks).values(tasks.slice(i, i + 500).map((t) => ({ ...t, planId, userId })));
    }
  });
}

/** The user's active plan; flips it to "completed" once its cycle (learning + revision) is over. */
export async function getActivePlan(userId: string, today: string) {
  const [plan] = await db.select().from(plans).where(and(eq(plans.userId, userId), eq(plans.status, "active")));
  if (!plan) return null;
  if (today > cycleEnd(plan.planData)) {
    await db.update(plans).set({ status: "completed", updatedAt: new Date() }).where(eq(plans.id, plan.id));
    return null;
  }
  return plan;
}

export async function missedCount(planId: string, today: string) {
  const [r] = await db
    .select({ c: sql<number>`count(*)::int` })
    .from(planTasks)
    .where(
      and(eq(planTasks.planId, planId), eq(planTasks.kind, "study"), eq(planTasks.status, "pending"), lt(planTasks.date, today))
    );
  return r?.c ?? 0;
}

export async function tasksForDates(planId: string, dates: string[]) {
  if (!dates.length) return [];
  return db
    .select()
    .from(planTasks)
    .where(and(eq(planTasks.planId, planId), inArray(planTasks.date, dates)))
    .orderBy(planTasks.date, planTasks.sort);
}
