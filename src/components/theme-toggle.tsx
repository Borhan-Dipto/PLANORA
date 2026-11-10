"use client";

import { useTheme } from "next-themes";
import { useMounted } from "@/lib/use-mounted";

const OPTIONS = [
  { value: "light", label: "☀️" },
  { value: "dark", label: "🌙" },
  { value: "system", label: "💻" },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Avoid hydration mismatch: render nothing meaningful until mounted.
  const mounted = useMounted();

  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          aria-label={opt.value}
          aria-pressed={mounted && theme === opt.value}
          className={`rounded-md px-2 py-1 text-sm transition-colors ${
            mounted && theme === opt.value
              ? "bg-accent text-accent-foreground"
              : "text-muted hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
