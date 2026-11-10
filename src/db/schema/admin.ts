import { pgTable, uuid, text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { profiles } from "./profiles";

/**
 * Append-only audit trail for admin and sensitive actions.
 * Never delete rows from this table.
 */
export const adminAuditLogs = pgTable("admin_audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  actorId: uuid("actor_id")
    .notNull()
    .references(() => profiles.id), // the admin who acted
  action: text("action").notNull(), // e.g. "user.suspend", "payment.approve"
  targetType: text("target_type"), // e.g. "profile", "payment_request"
  targetId: uuid("target_id"),
  metadata: jsonb("metadata"), // before/after or extra context
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("idx_admin_audit_logs_actor").on(t.actorId),
  index("idx_admin_audit_logs_target").on(t.targetType, t.targetId),
]);
