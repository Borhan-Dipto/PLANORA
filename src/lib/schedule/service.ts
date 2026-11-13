import "server-only";
import { and, eq, inArray, lt, gte, sql } from "drizzle-orm";
import { db, withDbRetry } from "@/db/client";
import { plans, planTasks, profiles } from "@/db/schema";
import { addDays, type PlanData } from "@/lib/plan/schema";
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

/**
 * Marks the next `days` calendar days (starting `today`) as a break: those dates show "বিরতি"
 * instead of the normal routine, and everything scheduled after them shifts back by exactly
 * `days` days — nothing else about the plan changes. Relies on two existing mechanisms rather
 * than adding new ones: `plan.breakDates` already extends learningEnd/cycleEnd (see
 * schedule/engine.ts), and inserting these rows with `locked: true` makes regenerateSchedule's
 * own `lockedDates` query (below) skip them automatically, exactly like a manually-fixed day.
 * Caller (the server action) is responsible for the access gate (super_admin-only for now).
 */
export async function takeBreak(planId: string, userId: string, plan: PlanData, today: string, days: number) {
  const existing = new Set(plan.breakDates ?? []);
  const newDates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = addDays(today, i);
    if (!existing.has(d)) newDates.push(d);
  }
  const breakDates = [...existing, ...newDates].sort();
  const data: PlanData = { ...plan, breakDates };

  await withDbRetry(() =>
    db.transaction(async (tx) => {
      if (newDates.length) {
        // Whatever was on these dates before (study/revision/habit, done or pending) is replaced
        // by the break — the day is now totally "off", as the user described wanting.
        await tx.delete(planTasks).where(and(eq(planTasks.planId, planId), inArray(planTasks.date, newDates)));
        await tx.insert(planTasks).values(
          newDates.map((d) => ({
            planId,
            userId,
            date: d,
            kind: "break" as const,
            subjectId: null,
            topicId: null,
            subjectName: null,
            title: "বিরতি",
            minutes: 0,
            part: 1,
            parts: 1,
            sort: -1,
            locked: true,
          })),
        );
      }
      await tx.update(plans).set({ planData: data, updatedAt: new Date() }).where(eq(plans.id, planId));
    }),
  );

  await regenerateSchedule(planId, userId, data, today);
  return data;
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
