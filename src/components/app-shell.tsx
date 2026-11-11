"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";
import { Logomark } from "@/components/brand/logomark";

const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard" as const, icon: "🏠" },
  { href: "/planner", key: "planner" as const, icon: "📅" },
  { href: "/subjects", key: "subjects" as const, icon: "📚" },
  { href: "/revision", key: "revision" as const, icon: "🔁" },
  { href: "/progress", key: "progress" as const, icon: "📈" },
  { href: "/billing", key: "billing" as const, icon: "💎" },
];

const SETTINGS_ITEM = { href: "/settings", key: "settings" as const, icon: "⚙️" };

function isActive(pathname: string, href: string) {
  return href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

export function AppShell({
  children,
  dict,
  locale,
}: {
  children: React.ReactNode;
  dict: Dictionary;
  locale: "bn" | "en";
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-60 flex-col border-r border-border bg-surface p-4 md:flex">
        <Link href="/dashboard" className="mb-6 flex items-center gap-2 px-1" aria-label="PLANORA — ড্যাশবোর্ডে যান">
          <Logomark className="h-7 w-7 shrink-0 drop-shadow-[0_2px_6px_rgba(37,99,235,0.35)]" />
          <span className="font-brand text-lg font-bold tracking-tight text-foreground">PLANORA</span>
        </Link>
        <nav className="flex flex-1 flex-col gap-0.5">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
                  active ? "bg-accent/10 text-accent" : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                <span className="text-base leading-none">{item.icon}</span>
                {dict.nav[item.key]}
              </Link>
            );
          })}
          <Link
            href={SETTINGS_ITEM.href}
            aria-current={isActive(pathname, SETTINGS_ITEM.href) ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium ${
              isActive(pathname, SETTINGS_ITEM.href) ? "bg-accent/10 text-accent" : "text-muted hover:bg-background hover:text-foreground"
            }`}
          >
            <span className="text-base leading-none">{SETTINGS_ITEM.icon}</span>
            {dict.nav.settings}
          </Link>
        </nav>
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <ThemeToggle />
          <LanguageToggle locale={locale} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        {children}

        {/* Mobile bottom nav — grid (not flex) so every item, including Settings, always has its own slot and never gets clipped */}
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid gap-0.5 border-t border-border bg-surface/95 p-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_-12px_rgba(16,24,40,0.18)] backdrop-blur md:hidden"
          style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length + 1}, minmax(0, 1fr))` }}
        >
          {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-w-0 flex-col items-center gap-0.5 rounded-xl px-0.5 py-1.5 transition-colors ${
                  active ? "bg-accent/10 text-accent" : "text-muted hover:bg-background hover:text-foreground"
                }`}
              >
                {active && (
                  <span className="absolute -top-[7px] h-[3px] w-5 rounded-full bg-accent" aria-hidden />
                )}
                <span className={`text-base leading-none transition-transform ${active ? "scale-110" : ""}`}>{item.icon}</span>
                <span className="w-full truncate text-center text-[10px] leading-tight font-semibold">{dict.nav[item.key]}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
