"use server";

import { desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { activationCodes, paymentRequests, subscriptions } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { getUserTier, getPremiumExpiry } from "@/lib/plan/tier";
import { BILLING_PLANS } from "@/lib/billing-config";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export async function getMyBilling() {
  const userId = await requireUserId();
  const [tier, expiresAt, payments] = await Promise.all([
    getUserTier(userId),
    getPremiumExpiry(userId),
    db.select().from(paymentRequests).where(eq(paymentRequests.userId, userId)).orderBy(desc(paymentRequests.createdAt)).limit(10),
  ]);
  return { tier, expiresAt, payments };
}

export async function submitBkashPayment(planCode: string, senderBkashNumber: string, transactionId: string): Promise<Result> {
  const userId = await requireUserId();
  const plan = BILLING_PLANS.find((p) => p.code === planCode);
  if (!plan) return { ok: false, error: "প্ল্যান বাছাই সঠিক নয়" };
  const sender = senderBkashNumber.trim();
  const trx = transactionId.trim().toUpperCase();
  if (!/^01\d{9}$/.test(sender)) return { ok: false, error: "বিকাশ নাম্বারটি সঠিক ফরম্যাটে দিন (০১XXXXXXXXX)" };
  if (trx.length < 6) return { ok: false, error: "ট্রানজেকশন আইডি (TrxID) সঠিক নয়" };

  await db.insert(paymentRequests).values({
    userId,
    planLabel: plan.label,
    amountBdt: plan.amountBdt,
    durationDays: plan.durationDays,
    senderBkashNumber: sender,
    transactionId: trx,
    status: "pending",
  });
  revalidatePath("/billing");
  return { ok: true };
}

export async function redeemActivationCode(codeInput: string): Promise<Result<{ expiresAt: string }>> {
  const userId = await requireUserId();
  const code = codeInput.trim().toUpperCase();
  if (!code) return { ok: false, error: "কোড লিখুন" };

  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(activationCodes).where(eq(activationCodes.code, code));
    if (!row) return { ok: false, error: "কোডটি সঠিক নয়" };
    if (row.usedCount >= row.maxUses) return { ok: false, error: "কোডটির মেয়াদ (ব্যবহারসীমা) শেষ হয়ে গেছে" };

    await tx.update(activationCodes).set({ usedCount: row.usedCount + 1 }).where(eq(activationCodes.id, row.id));

    const current = await getPremiumExpiry(userId);
    const base = current && current > new Date() ? current : new Date();
    const expiresAt = new Date(base.getTime() + row.durationDays * 86_400_000);
    await tx.insert(subscriptions).values({
      userId,
      source: "activation_code",
      durationDays: row.durationDays,
      expiresAt,
      activationCodeId: row.id,
    });
    revalidatePath("/billing");
    return { ok: true, expiresAt: expiresAt.toISOString() };
  });
}
