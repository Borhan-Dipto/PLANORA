import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getDictionary, getLocale } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";

export async function ComingSoonPage({ title, phase }: { title: string; phase: string }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const dict = await getDictionary();
  const locale = await getLocale();

  return (
    <AppShell dict={dict} locale={locale}>
      <header className="border-b border-border p-4">
        <h1 className="font-semibold">{title}</h1>
      </header>
      <main className="p-6">
        <div className="rounded-lg border border-border bg-surface p-6 text-center text-muted">
          এই ফিচার {phase}-এ আসবে।
        </div>
      </main>
    </AppShell>
  );
}
