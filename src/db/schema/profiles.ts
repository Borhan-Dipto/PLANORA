import { pgTable, uuid, text, timestamp, boolean, pgEnum } from "drizzle-orm/pg-core";

// Order here is display/hierarchy order, not the DB's physical enum order (Postgres enums keep
// values in the order they were first created; "moderator"/"manager" were added later via
// ALTER TYPE, so the DB's own ordering is user/admin/super_admin/moderator/manager — harmless,
// since nothing sorts by the enum's native order).
export const appRoleEnum = pgEnum("app_role", ["user", "moderator", "manager", "admin", "super_admin"]);
export const ASSIGNABLE_ROLES = ["user", "moderator", "manager", "admin", "super_admin"] as const;

/**
 * Mirrors auth.users (Supabase Auth). id = auth.users.id (1:1).
 * Never duplicate auth credentials here — only app-level profile data.
 */
export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // = auth.users.id
  displayName: text("display_name"),
  email: text("email"), // denormalized copy of verified email, for display/admin search only
  phone: text("phone"), // denormalized copy of verified phone, for display/admin search only
  role: appRoleEnum("role").notNull().default("user"),
  isSuspended: boolean("is_suspended").notNull().default(false),
  // true once the user has set a password (via /set-password, right after their first/recovery
  // OTP verification). Lets /login decide: known email + has_password -> ask for the password
  // directly; otherwise -> send a fresh OTP code (first signup, or password not set yet).
  hasPassword: boolean("has_password").notNull().default(false),
  timezone: text("timezone").notNull().default("Asia/Dhaka"),
  locale: text("locale").notNull().default("bn"), // "bn" | "en"
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => profiles.id, { onDelete: "cascade" }),
  theme: text("theme").notNull().default("system"), // "light" | "dark" | "system"
  notificationsEnabled: boolean("notifications_enabled").notNull().default(true),
  dailyReminderEnabled: boolean("daily_reminder_enabled").notNull().default(true),
  wakeTime: text("wake_time"), // "HH:mm", null = not set yet
  sleepTime: text("sleep_time"), // "HH:mm", null = not set yet
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
