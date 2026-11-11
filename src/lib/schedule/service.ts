import "server-only";
import { and, eq, inArray, lt, gte, sql } from "drizzle-orm";
import { db, withDbRetry } from "@/db/client";
import { plans, planTasks, profiles } from "@/db/schema";
import type { PlanData } from "@/lib/plan/schema";
import { buildRevisionTasks, buildSchedule, cycleEnd } from "./engine";

/** Today's date (YYYY-MM-DD) in the user's timezone. */
export async function todayFor(userId: string) {
  const [p] = await withDbRetry(() =>
    db.select({ tz: profiles.timezone }).from(profiles).where(eq(profiles.id, userId)),
  );
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
  await withDbRetry(() => db.transaction(async (tx) => {
    // Minutes already "spoken for" per topic: actually done, OR locked-but-not-yet-done (the user
    // fixed these manually for their day — the auto-engine must not re-schedule that time elsewhere).
    const spoken = await tx
      .select({ topicId: planTasks.topicId, minutes: sql<number>`sum(${planTasks.minutes})::int` })
      .from(planTasks)
      .where(
        and(
          eq(planTasks.planId, planId),
          inArray(planTasks.kind, ["study", "revision"]),
          sql`(${planTasks.status} = 'done' or ${planTasks.locked} = true)`
        )
      )
      .groupBy(planTasks.topicId);
    const spokenBy = new Map(spoken.map((d) => [d.topicId, d.minutes]));

    const remaining = new Map<string, number>();
    for (const s of plan.subjects)
      for (const t of s.topics) {
        const left = t.estimatedMinutes - (spokenBy.get(t.id) ?? 0);
        remaining.set(t.id, left < 15 ? 0 : left); // tiny leftovers count as finished
      }

    const lockedRows = await tx
      .select({ date: planTasks.date })
      .from(planTasks)
      .where(and(eq(planTasks.planId, planId), eq(planTasks.locked, true), gte(planTasks.date, from)));
    const lockedDates = new Set(lockedRows.map((r) => r.date));

    await tx
      .delete(planTasks)
      .where(
        and(
          eq(planTasks.planId, planId),
          eq(planTasks.kind, "study"),
          eq(planTasks.status, "pending"),
          eq(planTasks.locked, false)
        )
      );
    await tx
      .delete(planTasks)
      .where(
        and(eq(planTasks.planId, planId), eq(planTasks.kind, "habit"), eq(planTasks.status, "pending"), gte(planTasks.date, from))
      );
    await tx
      .delete(planTasks)
      .where(
        and(
          eq(planTasks.planId, planId),
          eq(planTasks.kind, "revision"),
          eq(planTasks.status, "pending"),
          eq(planTasks.locked, false)
        )
      );

    const { tasks } = buildSchedule(plan, from, remaining, from, lockedDates);
    const allTasks = [...tasks, ...buildRevisionTasks(plan, from, lockedDates)];
    for (let i = 0; i < allTasks.length; i += 500) {
      await tx.insert(planTasks).values(allTasks.slice(i, i + 500).map((t) => ({ ...t, planId, userId })));
    }
  }));
}

/** The user's active plan; flips it to "completed" once its cycle (learning + revision) is over. */
export async function getActivePlan(userId: string, today: string) {
  const [plan] = await withDbRetry(() =>
    db.select().from(plans).where(and(eq(plans.userId, userId), eq(plans.status, "active"))),
  );
  if (!plan) return null;
  if (today > cycleEnd(plan.planData)) {
    await withDbRetry(() =>
      db.update(plans).set({ status: "completed", updatedAt: new Date() }).where(eq(plans.id, plan.id)),
    );
    return null;
  }
  return plan;
}

export async function missedCount(planId: string, today: string) {
  const [r] = await withDbRetry(() =>
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(planTasks)
      .where(
        and(
          eq(planTasks.planId, planId),
          inArray(planTasks.kind, ["study", "revision"]),
          eq(planTasks.status, "pending"),
          lt(planTasks.date, today)
        )
      ),
  );
  return r?.c ?? 0;
}

export async function tasksForDates(planId: string, dates: string[]) {
  if (!dates.length) return [];
  return withDbRetry(() =>
    db
      .select()
      .from(planTasks)
      .where(and(eq(planTasks.planId, planId), inArray(planTasks.date, dates)))
      .orderBy(planTasks.date, planTasks.sort),
  );
}
