import Link from "next/link";
import type { Dictionary } from "@/lib/i18n";
import { ThemeToggle } from "@/components/theme-toggle";
import { LanguageToggle } from "@/components/language-toggle";

const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard" as const, icon: "🏠" },
  { href: "/planner", key: "planner" as const, icon: "📅" },
  { href: "/subjects", key: "subjects" as const, icon: "📚" },
  { href: "/revision", key: "revision" as const, icon: "🔁" },
  { href: "/progress", key: "progress" as const, icon: "📈" },
  { href: "/billing", key: "billing" as const, icon: "💎" },
];

const SETTINGS_ITEM = { href: "/settings", key: "settings" as const, icon: "⚙️" };

export function AppShell({
  children,
  dict,
  locale,
}: {
  children: React.ReactNode;
  dict: Dictionary;
  locale: "bn" | "en";
}) {
  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="hidden w-56 flex-col border-r border-border bg-surface p-4 md:flex">
        <Link href="/dashboard" className="mb-6 text-lg font-bold text-accent">
          PLANORA
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm text-muted hover:bg-background hover:text-foreground"
            >
              <span className="mr-2">{item.icon}</span>
              {dict.nav[item.key]}
            </Link>
          ))}
          <Link
            href={SETTINGS_ITEM.href}
            className="rounded-md px-3 py-2 text-sm text-muted hover:bg-background hover:text-foreground"
          >
            <span className="mr-2">{SETTINGS_ITEM.icon}</span>
            {dict.nav.settings}
          </Link>
        </nav>
        <div className="flex flex-col gap-2">
          <ThemeToggle />
          <LanguageToggle locale={locale} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">
        {children}

        {/* Mobile bottom nav — grid (not flex) so every item, including Settings, always has its own slot and never gets clipped */}
        <nav
          className="fixed inset-x-0 bottom-0 z-20 grid border-t border-border bg-surface py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] md:hidden"
          style={{ gridTemplateColumns: `repeat(${NAV_ITEMS.length + 1}, minmax(0, 1fr))` }}
        >
          {[...NAV_ITEMS, SETTINGS_ITEM].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-w-0 flex-col items-center gap-0.5 px-0.5 text-muted"
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span className="w-full truncate text-center text-[10px] leading-tight">{dict.nav[item.key]}</span>
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
