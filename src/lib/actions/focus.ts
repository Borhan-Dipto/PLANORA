"use server";

import { and, eq, sql } from "drizzle-orm";
import { db, withDbRetry } from "@/db/client";
import { focusSessions, planTasks } from "@/db/schema";
import { requireUserId } from "@/lib/session";

export type ActiveSession = {
  id: string;
  planId: string;
  taskId: string | null;
  title: string;
  subjectName: string | null;
  targetMinutes: number;
  startedAtIso: string;
  distractionCount: number;
};

function toSession(s: typeof focusSessions.$inferSelect): ActiveSession {
  return {
    id: s.id,
    planId: s.planId,
    taskId: s.taskId,
    title: s.title,
    subjectName: s.subjectName,
    targetMinutes: s.targetMinutes,
    startedAtIso: s.startedAt.toISOString(),
    distractionCount: s.distractionCount,
  };
}

/**
 * Starts focus mode for a task, or — if the user already has a session running (any task) —
 * resumes that one instead. This is deliberate: switching tasks can never reset the clock.
 */
export async function startFocusSession(taskId: string): Promise<{ ok: true; session: ActiveSession } | { ok: false; error: string }> {
  const userId = await requireUserId();

  const [existing] = await withDbRetry(() =>
    db.select().from(focusSessions).where(and(eq(focusSessions.userId, userId), eq(focusSessions.status, "active"))),
  );
  if (existing) return { ok: true, session: toSession(existing) };

  const [task] = await withDbRetry(() =>
    db.select().from(planTasks).where(and(eq(planTasks.id, taskId), eq(planTasks.userId, userId))),
  );
  if (!task || (task.kind !== "study" && task.kind !== "revision") || task.status !== "pending")
    return { ok: false, error: "টপিকটি পাওয়া যায়নি বা শুরু করা যাচ্ছে না" };

  const [session] = await withDbRetry(() =>
    db
      .insert(focusSessions)
      .values({
        userId,
        planId: task.planId,
        taskId: task.id,
        title: task.title,
        subjectName: task.subjectName,
        targetMinutes: task.minutes,
      })
      // A double-tap / second tab can race past the check above; the one-active-per-user index then
      // rejects the second insert — resume whichever session won instead of throwing.
      .onConflictDoNothing()
      .returning(),
  );
  if (session) return { ok: true, session: toSession(session) };
  const [winner] = await withDbRetry(() =>
    db.select().from(focusSessions).where(and(eq(focusSessions.userId, userId), eq(focusSessions.status, "active"))),
  );
  return winner ? { ok: true, session: toSession(winner) } : { ok: false, error: "ফোকাস সেশন শুরু করা যায়নি, আবার চেষ্টা করুন" };
}

export async function getActiveFocusSession(): Promise<ActiveSession | null> {
  const userId = await requireUserId();
  const [s] = await withDbRetry(() =>
    db.select().from(focusSessions).where(and(eq(focusSessions.userId, userId), eq(focusSessions.status, "active"))),
  );
  return s ? toSession(s) : null;
}

/** Heartbeat — keeps last_ping_at fresh and records a distraction (tab/app switch) if reported. */
export async function pingFocusSession(sessionId: string, addDistraction: boolean) {
  const userId = await requireUserId();
  await withDbRetry(() =>
    db
      .update(focusSessions)
      .set({
        lastPingAt: new Date(),
        ...(addDistraction ? { distractionCount: sql`${focusSessions.distractionCount} + 1` } : {}),
      })
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId), eq(focusSessions.status, "active"))),
  );
  return { ok: true as const };
}

export async function completeFocusSession(sessionId: string) {
  const userId = await requireUserId();
  const [session] = await withDbRetry(() =>
    db
      .select()
      .from(focusSessions)
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId), eq(focusSessions.status, "active"))),
  );
  if (!session) return { ok: false as const, error: "সেশনটি পাওয়া যায়নি" };

  const endedAt = new Date();
  const actualMinutes = Math.max(1, Math.round((endedAt.getTime() - session.startedAt.getTime()) / 60000));

  await withDbRetry(() => db.update(focusSessions).set({ status: "completed", endedAt }).where(eq(focusSessions.id, sessionId)));
  if (session.taskId) {
    await withDbRetry(() =>
      db.update(planTasks).set({ status: "done", completedAt: endedAt }).where(eq(planTasks.id, session.taskId!)),
    );
  }
  // Deliberately no revalidatePath() here: this action runs while the client is still on
  // /focus/[taskId]. Next.js bundles any revalidatePath-triggered revalidation into THIS same
  // response as an implicit re-render of the CURRENTLY VIEWED route (not just the revalidated
  // path) — which would re-run that page's own startFocusSession(taskId) check server-side right
  // after this update, see it as no-longer-pending, and call notFound() before the client ever
  // gets to show the "সম্পন্ন!" screen. The dashboard/schedule pages read via requireUserId()
  // (dynamic, uncached), so they already render fresh data on the next real navigation without needing revalidation here.
  return { ok: true as const, actualMinutes, targetMinutes: session.targetMinutes };
}

export async function emergencyExitFocusSession(sessionId: string, reason: string) {
  const userId = await requireUserId();
  await withDbRetry(() =>
    db
      .update(focusSessions)
      .set({ status: "exited", endedAt: new Date(), exitReason: reason.slice(0, 300) || "কারণ দেওয়া হয়নি" })
      .where(and(eq(focusSessions.id, sessionId), eq(focusSessions.userId, userId), eq(focusSessions.status, "active"))),
  );
  // Same reason as completeFocusSession above: no revalidatePath while still on /focus/[taskId].
  return { ok: true as const };
}
