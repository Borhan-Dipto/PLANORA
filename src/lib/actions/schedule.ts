"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { plans, planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { regenerateSchedule, todayFor } from "@/lib/schedule/service";

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
