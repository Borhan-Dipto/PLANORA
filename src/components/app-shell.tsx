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
];

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
            href="/settings"
            className="rounded-md px-3 py-2 text-sm text-muted hover:bg-background hover:text-foreground"
          >
            <span className="mr-2">⚙️</span>
            {dict.nav.settings}
          </Link>
        </nav>
        <div className="flex flex-col gap-2">
          <ThemeToggle />
          <LanguageToggle locale={locale} />
        </div>
      </aside>

      <div className="flex flex-1 flex-col pb-16 md:pb-0">
        {children}

        {/* Mobile bottom nav */}
        <nav className="fixed inset-x-0 bottom-0 flex justify-around border-t border-border bg-surface py-2 md:hidden">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 px-2 text-xs text-muted"
            >
              <span className="text-base">{item.icon}</span>
              {dict.nav[item.key]}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
