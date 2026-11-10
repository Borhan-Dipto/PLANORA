import { pgTable, uuid, text, integer, date, timestamp, pgEnum, index, boolean } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";
import { plans } from "./plans";

export const taskKindEnum = pgEnum("task_kind", ["study", "habit", "revision"]);
export const taskStatusEnum = pgEnum("task_status", ["pending", "done", "skipped"]);

/** One scheduled item on one day. Titles are snapshotted so history survives plan edits. */
export const planTasks = pgTable(
  "plan_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    planId: uuid("plan_id").notNull().references(() => plans.id, { onDelete: "cascade" }),
    userId: uuid("user_id").notNull().references(() => profiles.id, { onDelete: "cascade" }),
    date: date("date").notNull(),
    kind: taskKindEnum("kind").notNull(),
    subjectId: text("subject_id"),
    topicId: text("topic_id"),
    subjectName: text("subject_name"),
    title: text("title").notNull(),
    minutes: integer("minutes").notNull().default(0),
    part: integer("part").notNull().default(1),
    parts: integer("parts").notNull().default(1),
    sort: integer("sort").notNull().default(0),
    status: taskStatusEnum("status").notNull().default("pending"),
    /** Set when the user manually fixed this task's minutes for its day — the auto-scheduler
     * never touches a locked task, and its minutes count as "spoken for" when recomputing how
     * much of the topic is left for other days, whether or not it's been marked done yet. */
    locked: boolean("locked").notNull().default(false),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("plan_tasks_plan_date_idx").on(t.planId, t.date), index("plan_tasks_user_date_idx").on(t.userId, t.date)]
);
