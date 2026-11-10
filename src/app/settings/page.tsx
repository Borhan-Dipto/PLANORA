import { eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { userPreferences } from "@/db/schema";
import { getDictionary, getLocale } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { SleepScheduleForm } from "@/components/sleep-schedule-form";

export const instant = false;

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [dict, locale, [prefs]] = await Promise.all([
    getDictionary(),
    getLocale(),
    db.select().from(userPreferences).where(eq(userPreferences.userId, user.id)),
  ]);

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
      </main>
    </AppShell>
  );
}
