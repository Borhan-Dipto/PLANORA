"use server";

import { count, desc, eq, gte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, withDbRetry } from "@/db/client";
import {
  profiles,
  activationCodes,
  paymentRequests,
  subscriptions,
  adminAuditLogs,
  aiUsageLogs,
  plans,
  ASSIGNABLE_ROLES,
} from "@/db/schema";
import { requireAdminId, requireSuperAdminId } from "@/lib/session";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function audit(actorId: string, action: string, targetType: string, targetId: string, metadata?: object) {
  await withDbRetry(() =>
    db.insert(adminAuditLogs).values({ actorId, action, targetType, targetId, metadata: metadata ?? null }),
  );
}

/* ---------------- overview ---------------- */

export async function getAdminOverview() {
  await requireAdminId();
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [[users], [premium], [pendingPayments], [aiToday], [activePlans]] = await withDbRetry(() =>
    Promise.all([
      db.select({ c: count() }).from(profiles),
      db
        .select({ c: sql<number>`count(distinct ${subscriptions.userId})::int` })
        .from(subscriptions)
        .where(gte(subscriptions.expiresAt, new Date())),
      db.select({ c: count() }).from(paymentRequests).where(eq(paymentRequests.status, "pending")),
      db.select({ c: count() }).from(aiUsageLogs).where(gte(aiUsageLogs.createdAt, since24h)),
      db.select({ c: count() }).from(plans).where(eq(plans.status, "active")),
    ]),
  );
  return { users: users.c, premium: premium.c, pendingPayments: pendingPayments.c, aiToday: aiToday.c, activePlans: activePlans.c };
}

/* ---------------- users ---------------- */

export async function listUsers(limit = 50) {
  await requireAdminId();
  return withDbRetry(() =>
    db
      .select({
        id: profiles.id,
        displayName: profiles.displayName,
        email: profiles.email,
        role: profiles.role,
        isSuspended: profiles.isSuspended,
        createdAt: profiles.createdAt,
      })
      .from(profiles)
      .orderBy(desc(profiles.createdAt))
      .limit(limit),
  );
}

export async function setUserSuspended(userId: string, suspended: boolean): Promise<Result> {
  const { userId: actorId } = await requireAdminId();
  if (userId === actorId) return { ok: false, error: "নিজেকে সাসপেন্ড করা যাবে না" };
  await withDbRetry(() =>
    db.update(profiles).set({ isSuspended: suspended, updatedAt: new Date() }).where(eq(profiles.id, userId)),
  );
  await audit(actorId, suspended ? "user.suspend" : "user.unsuspend", "profile", userId);
  revalidatePath("/admin");
  return { ok: true };
}

/** Super-admin only: assign any role (user/moderator/manager/admin/super_admin) to any user —
 * the "grow the team" control (managers, moderators, etc. as the company hires). */
export async function setUserRole(userId: string, role: string): Promise<Result> {
  const { userId: actorId } = await requireSuperAdminId();
  if (!ASSIGNABLE_ROLES.includes(role as (typeof ASSIGNABLE_ROLES)[number]))
    return { ok: false, error: "রোলটি সঠিক নয়" };
  if (userId === actorId && role !== "super_admin")
    return { ok: false, error: "নিজের সুপার অ্যাডমিন রোল এখান থেকে পরিবর্তন করা যাবে না" };

  const [before] = await withDbRetry(() =>
    db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)),
  );
  await withDbRetry(() =>
    db
      .update(profiles)
      .set({ role: role as (typeof ASSIGNABLE_ROLES)[number], updatedAt: new Date() })
      .where(eq(profiles.id, userId)),
  );
  await audit(actorId, "role.change", "profile", userId, { from: before?.role, to: role });
  revalidatePath("/admin");
  return { ok: true };
}

/* ---------------- payments ---------------- */

export async function listPayments(status?: "pending" | "approved" | "rejected", limit = 50) {
  await requireAdminId();
  const rows = await withDbRetry(() =>
    db
      .select({
        id: paymentRequests.id,
        userId: paymentRequests.userId,
        email: profiles.email,
        displayName: profiles.displayName,
        planLabel: paymentRequests.planLabel,
        amountBdt: paymentRequests.amountBdt,
        durationDays: paymentRequests.durationDays,
        senderBkashNumber: paymentRequests.senderBkashNumber,
        transactionId: paymentRequests.transactionId,
        status: paymentRequests.status,
        createdAt: paymentRequests.createdAt,
      })
      .from(paymentRequests)
      .leftJoin(profiles, eq(profiles.id, paymentRequests.userId))
      .where(status ? eq(paymentRequests.status, status) : undefined)
      .orderBy(desc(paymentRequests.createdAt))
      .limit(limit),
  );
  return rows;
}

export async function approvePayment(paymentId: string): Promise<Result> {
  const { userId: actorId } = await requireAdminId();
  return withDbRetry(() => db.transaction(async (tx) => {
    const [payment] = await tx.select().from(paymentRequests).where(eq(paymentRequests.id, paymentId));
    if (!payment) return { ok: false, error: "পেমেন্টটি পাওয়া যায়নি" };
    if (payment.status !== "pending") return { ok: false, error: "এই পেমেন্টটি আগেই পর্যালোচনা হয়ে গেছে" };

    const [latest] = await tx
      .select({ expiresAt: subscriptions.expiresAt })
      .from(subscriptions)
      .where(eq(subscriptions.userId, payment.userId))
      .orderBy(desc(subscriptions.expiresAt))
      .limit(1);
    const base = latest && latest.expiresAt > new Date() ? latest.expiresAt : new Date();
    const expiresAt = new Date(base.getTime() + payment.durationDays * 86_400_000);

    await tx.insert(subscriptions).values({
      userId: payment.userId,
      source: "bkash",
      durationDays: payment.durationDays,
      expiresAt,
      paymentRequestId: payment.id,
      grantedBy: actorId,
    });
    await tx
      .update(paymentRequests)
      .set({ status: "approved", reviewedBy: actorId, reviewedAt: new Date() })
      .where(eq(paymentRequests.id, paymentId));
    await audit(actorId, "payment.approve", "payment_request", paymentId, { expiresAt: expiresAt.toISOString() });
    revalidatePath("/admin");
    return { ok: true };
  }));
}

export async function rejectPayment(paymentId: string, note: string): Promise<Result> {
  const { userId: actorId } = await requireAdminId();
  const [payment] = await withDbRetry(() =>
    db.select().from(paymentRequests).where(eq(paymentRequests.id, paymentId)),
  );
  if (!payment) return { ok: false, error: "পেমেন্টটি পাওয়া যায়নি" };
  if (payment.status !== "pending") return { ok: false, error: "এই পেমেন্টটি আগেই পর্যালোচনা হয়ে গেছে" };
  await withDbRetry(() =>
    db
      .update(paymentRequests)
      .set({ status: "rejected", reviewNote: note.slice(0, 300) || null, reviewedBy: actorId, reviewedAt: new Date() })
      .where(eq(paymentRequests.id, paymentId)),
  );
  await audit(actorId, "payment.reject", "payment_request", paymentId, { note });
  revalidatePath("/admin");
  return { ok: true };
}

/* ---------------- activation codes ---------------- */

function generateCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I ambiguity
  const part = () =>
    Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `PLNR-${part()}-${part()}`;
}

export async function createActivationCode(durationDays: number, maxUses: number, note: string): Promise<Result<{ code: string }>> {
  const { userId: actorId } = await requireAdminId();
  if (!Number.isFinite(durationDays) || durationDays < 1 || durationDays > 3650)
    return { ok: false, error: "মেয়াদ (দিন) সঠিক নয়" };
  if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 100_000) return { ok: false, error: "সর্বোচ্চ ব্যবহার সংখ্যা সঠিক নয়" };

  const code = generateCode();
  await withDbRetry(() =>
    db.insert(activationCodes).values({ code, durationDays, maxUses, note: note.slice(0, 200) || null, createdBy: actorId }),
  );
  await audit(actorId, "code.create", "activation_code", code, { durationDays, maxUses });
  revalidatePath("/admin");
  return { ok: true, code };
}

export async function listActivationCodes(limit = 50) {
  await requireAdminId();
  return withDbRetry(() => db.select().from(activationCodes).orderBy(desc(activationCodes.createdAt)).limit(limit));
}

/* ---------------- audit log ---------------- */

export async function listAuditLog(limit = 30) {
  await requireAdminId();
  return withDbRetry(() =>
    db
      .select({
        id: adminAuditLogs.id,
        action: adminAuditLogs.action,
        targetType: adminAuditLogs.targetType,
        targetId: adminAuditLogs.targetId,
        metadata: adminAuditLogs.metadata,
        createdAt: adminAuditLogs.createdAt,
        actorEmail: profiles.email,
      })
      .from(adminAuditLogs)
      .leftJoin(profiles, eq(profiles.id, adminAuditLogs.actorId))
      .orderBy(desc(adminAuditLogs.createdAt))
      .limit(limit),
  );
}
