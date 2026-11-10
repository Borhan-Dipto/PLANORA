import { pgTable, uuid, text, integer, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

/** Admin-issued codes (promotions, manual sales) that grant premium on redemption. */
export const activationCodes = pgTable("activation_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  durationDays: integer("duration_days").notNull(),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  note: text("note"),
  createdBy: uuid("created_by").notNull().references(() => profiles.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const paymentStatusEnum = pgEnum("payment_status", ["pending", "approved", "rejected"]);

/** A user's manual bKash payment submission, awaiting admin review. */
export const paymentRequests = pgTable(
  "payment_requests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    planLabel: text("plan_label").notNull(),
    amountBdt: integer("amount_bdt").notNull(),
    durationDays: integer("duration_days").notNull(),
    senderBkashNumber: text("sender_bkash_number").notNull(),
    transactionId: text("transaction_id").notNull(),
    status: paymentStatusEnum("status").notNull().default("pending"),
    reviewNote: text("review_note"),
    reviewedBy: uuid("reviewed_by").references(() => profiles.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_payment_requests_user").on(t.userId), index("idx_payment_requests_status").on(t.status)]
);

export const subscriptionSourceEnum = pgEnum("subscription_source", ["bkash", "activation_code", "admin_grant"]);

/** One row per premium grant. A user is premium while any row's expiresAt is in the future. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    source: subscriptionSourceEnum("source").notNull(),
    durationDays: integer("duration_days").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    paymentRequestId: uuid("payment_request_id").references(() => paymentRequests.id),
    activationCodeId: uuid("activation_code_id").references(() => activationCodes.id),
    grantedBy: uuid("granted_by").references(() => profiles.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_subscriptions_user_expires").on(t.userId, t.expiresAt)]
);
