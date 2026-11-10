/** bKash is accepted manually: the user pays to this number, then submits the TrxID for review. */
export const BKASH_RECEIVE_NUMBER = process.env.BKASH_RECEIVE_NUMBER || "01XXXXXXXXX";

export const BILLING_PLANS = [
  { code: "1m", label: "১ মাস", durationDays: 30, amountBdt: 99 },
  { code: "3m", label: "৩ মাস", durationDays: 90, amountBdt: 249 },
  { code: "12m", label: "১ বছর", durationDays: 365, amountBdt: 799 },
] as const;
