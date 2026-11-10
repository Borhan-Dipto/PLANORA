"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { userPreferences } from "@/db/schema";
import { requireUserId } from "@/lib/session";

const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;

export async function setSleepSchedule(wakeTime: string, sleepTime: string) {
  const userId = await requireUserId();
  if (!timeRe.test(wakeTime) || !timeRe.test(sleepTime)) return { ok: false as const, error: "সময় সঠিক নয়" };

  await db
    .insert(userPreferences)
    .values({ userId, wakeTime, sleepTime })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { wakeTime, sleepTime, updatedAt: new Date() } });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  return { ok: true as const };
}
