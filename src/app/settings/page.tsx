import { eq } from "drizzle-orm";
import Link from "next/link";
import { requireUserId } from "@/lib/session";
import { db } from "@/db/client";
import { userPreferences, profiles } from "@/db/schema";
import { getDictionary, getLocale } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { SleepScheduleForm } from "@/components/sleep-schedule-form";

export default async function SettingsPage() {
  const userId = await requireUserId();

  const [dict, locale, [prefs], [profile]] = await Promise.all([
    getDictionary(),
    getLocale(),
    db.select().from(userPreferences).where(eq(userPreferences.userId, userId)),
    db.select({ role: profiles.role }).from(profiles).where(eq(profiles.id, userId)),
  ]);
  const isAdmin = profile?.role === "admin" || profile?.role === "super_admin";

  return (
    <AppShell dict={dict} locale={locale}>
      <header className="border-b border-border p-4">
        <h1 className="font-semibold">{dict.settings.title}</h1>
      </header>
      <main className="space-y-6 p-6">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <span>{dict.settings.theme}</span>
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-4">
          <span>{dict.settings.language}</span>
          <LanguageToggle locale={locale} />
        </div>
        <SleepScheduleForm wakeTime={prefs?.wakeTime ?? null} sleepTime={prefs?.sleepTime ?? null} />
        <Link
          href="/billing"
          className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 hover:border-accent"
        >
          <span>💎 প্রিমিয়াম</span>
          <span className="text-muted">→</span>
        </Link>
        {isAdmin && (
          <Link
            href="/admin"
            className="flex items-center justify-between rounded-lg border border-border bg-surface p-4 hover:border-accent"
          >
            <span>🛠️ অ্যাডমিন প্যানেল</span>
            <span className="text-muted">→</span>
          </Link>
        )}
      </main>
    </AppShell>
  );
}
