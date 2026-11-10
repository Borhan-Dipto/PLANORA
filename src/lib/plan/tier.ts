import "server-only";

export type Tier = "free" | "premium";

/** Subscription tier. Phase 7 (payments/activation codes) will read the real subscription here. */
export async function getUserTier(_userId: string): Promise<Tier> {
  return "free";
}
