import { pgTable, uuid, text, integer, date, jsonb, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import type { PlanData } from "@/lib/plan/schema";

export const planStatusEnum = pgEnum("plan_status", ["draft", "active", "completed", "archived"]);
export const planSourceEnum = pgEnum("plan_source", ["manual", "ai_chat", "automatic"]);

/** A study plan = one 30-day learning cycle + N revision days. Content lives in versioned JSON (planData). */
export const plans = pgTable(
  "plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    status: planStatusEnum("status").notNull().default("draft"),
    source: planSourceEnum("source").notNull(),
    schemaVersion: integer("schema_version").notNull().default(1),
    planData: jsonb("plan_data").$type<PlanData>().notNull(),
    startDate: date("start_date"),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("plans_user_status_idx").on(t.userId, t.status)]
);

/** One row per AI call — used for daily quotas (Phase 7 will tie limits to subscription). */
export const aiUsageLogs = pgTable(
  "ai_usage_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    feature: text("feature").notNull(),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("ai_usage_user_created_idx").on(t.userId, t.createdAt)]
);
