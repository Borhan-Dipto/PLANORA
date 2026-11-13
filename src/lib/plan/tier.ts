import "server-only";
import { and, eq, gt, desc } from "drizzle-orm";
import { db, withDbRetry } from "@/db/client";
import { subscriptions, profiles } from "@/db/schema";

export type Tier = "free" | "premium";

/**
 * A user is premium while they have any subscription row whose expiresAt is still in the future —
 * or, regardless of subscription, while they are the super_admin: the super_admin can use every
 * premium feature (flexible revision days, higher AI quota, and anything added later) without
 * ever needing to buy or be granted a plan.
 */
export async function getUserTier(userId: string): Promise<Tier> {
  const [profile] = await withDbRetry(() => db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)));
  if (profile?.role === "super_admin") return "premium";

  const [row] = await withDbRetry(() =>
    db
      .select({ expiresAt: subscriptions.expiresAt })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, userId), gt(subscriptions.expiresAt, new Date())))
      .orderBy(desc(subscriptions.expiresAt))
      .limit(1),
  );
  return row ? "premium" : "free";
}

/** The latest date premium runs out, across every (possibly stacked) subscription row — null if never subscribed. */
export async function getPremiumExpiry(userId: string): Promise<Date | null> {
  const [row] = await withDbRetry(() =>
    db
      .select({ expiresAt: subscriptions.expiresAt })
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.expiresAt))
      .limit(1),
  );
  if (!row) return null;
  return row.expiresAt > new Date() ? row.expiresAt : null;
}

export const AI_DAILY_LIMIT: Record<Tier, number> = { free: 10, premium: 100 };
