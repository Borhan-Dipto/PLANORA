import Link from "next/link";
import { getDictionary, getLocale } from "@/lib/i18n";
import { AppShell } from "@/components/app-shell";

/** Authenticated page chrome: shell + sticky header with optional back link. Call requireUserId() first. */
export async function PageFrame({
  title,
  back,
  actions,
  children,
}: {
  title: string;
  back?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [dict, locale] = await Promise.all([getDictionary(), getLocale()]);
  return (
    <AppShell dict={dict} locale={locale}>
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-surface/95 px-4 py-3 backdrop-blur">
        <Link
          href="/dashboard"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-accent-foreground md:hidden"
          aria-label="PLANORA — ড্যাশবোর্ডে যান"
        >
          P
        </Link>
        {back && (
          <Link href={back} className="shrink-0 text-muted hover:text-foreground" aria-label="ফিরে যান">
            ←
          </Link>
        )}
        <h1 className="min-w-0 flex-1 truncate font-semibold">{title}</h1>
        {actions}
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 p-4 sm:p-6">{children}</main>
    </AppShell>
  );
}
