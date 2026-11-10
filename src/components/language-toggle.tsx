"use client";

import { useTransition } from "react";
import { setLocale } from "@/lib/actions/locale";

export function LanguageToggle({ locale }: { locale: "bn" | "en" }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {(["bn", "en"] as const).map((l) => (
        <button
          key={l}
          disabled={pending}
          onClick={() => startTransition(() => setLocale(l))}
          className={`rounded-md px-2 py-1 text-sm transition-colors disabled:opacity-50 ${
            locale === l ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
          }`}
        >
          {l === "bn" ? "বাং" : "EN"}
        </button>
      ))}
    </div>
  );
}
