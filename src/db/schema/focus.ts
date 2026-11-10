import { pgTable, uuid, text, integer, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { plans } from "./plans";
import { planTasks } from "./schedule";

export const focusStatusEnum = pgEnum("focus_status", ["active", "completed", "exited"]);

/**
 * One focus-mode session. Title/subjectName/targetMinutes are snapshotted at start so the session
 * stays meaningful even if the plan is edited or the task later changes. The server's own
 * started_at / last_ping_at / ended_at clock is the only source of truth for elapsed time —
 * the client never gets to report how long it studied.
 */
export const focusSessions = pgTable(
  "focus_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    planId: uuid("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
    taskId: uuid("task_id").references(() => planTasks.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    subjectName: text("subject_name"),
    targetMinutes: integer("target_minutes").notNull().default(0),
    status: focusStatusEnum("status").notNull().default("active"),
    distractionCount: integer("distraction_count").notNull().default(0),
    exitReason: text("exit_reason"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    lastPingAt: timestamp("last_ping_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("focus_sessions_user_status_idx").on(t.userId, t.status)]
);
