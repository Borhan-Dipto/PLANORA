import { redirect } from "next/navigation";
import { getActiveFocusSession } from "@/lib/actions/focus";
import { CustomTimerForm } from "@/components/focus/custom-timer-form";
import { AppShell } from "@/components/app-shell";
import { getDictionary, getLocale } from "@/lib/i18n";

/** Nav entry point for starting a fresh ad-hoc ("কাস্টম") focus session. If one's already
 * running — plan task or ad-hoc — go resume it at /focus instead of showing the form again.
 * getActiveFocusSession() already requires auth, so no separate check is needed here. */
export default async function CustomTimerPage() {
  const [session, dict, locale] = await Promise.all([getActiveFocusSession(), getDictionary(), getLocale()]);
  if (session) redirect("/focus");

  return (
    <AppShell dict={dict} locale={locale}>
      <main className="mx-auto w-full max-w-md p-4 pt-8 sm:p-6">
        <CustomTimerForm />
      </main>
    </AppShell>
  );
}
