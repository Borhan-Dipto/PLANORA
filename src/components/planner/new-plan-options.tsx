"use client";

import { useState } from "react";
import Link from "next/link";
import { MIN_LEARNING_DAYS, MAX_LEARNING_DAYS, LEARNING_DAYS } from "@/lib/plan/schema";
import { ui } from "@/components/ui";

const OPTIONS = [
  { href: "/planner/new/ai", icon: "💬", title: "AI চ্যাট", desc: "কথা বলে বলে AI-এর সাথে প্ল্যান বানান" },
  { href: "/planner/new/auto", icon: "✨", title: "অটোমেটিক", desc: "বিষয় দিন, AI পুরো প্ল্যান বানিয়ে দেবে" },
  { href: "/planner/new/manual", icon: "✍️", title: "ম্যানুয়াল", desc: "নিজের হাতে সাজান, অথবা ChatGPT/Claude-এর JSON ইমপোর্ট করুন" },
] as const;

const DURATION_PRESETS = [
  { days: 10, label: "১০ দিন" },
  { days: 15, label: "১৫ দিন" },
  { days: 30, label: "৩০ দিন (১ মাস)" },
  { days: 60, label: "৬০ দিন (২ মাস)" },
  { days: 90, label: "৯০ দিন (৩ মাস)" },
];

/** Renders the 3 "create a new plan" options. For the super_admin, a duration picker appears
 * first — the chosen length is carried into whichever of the 3 options they pick next via a
 * `?days=` query param. Everyone else sees exactly the plain 3 cards (fixed 30-day default). */
export function NewPlanOptions({ isSuperAdmin }: { isSuperAdmin: boolean }) {
  const [days, setDays] = useState(LEARNING_DAYS);

  if (!isSuperAdmin) {
    return (
      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <Link key={o.href} href={o.href} className={`${ui.card} block transition hover:border-accent`}>
            <span className="text-2xl">{o.icon}</span>
            <p className="mt-2 font-semibold">{o.title}</p>
            <p className="mt-1 text-sm text-muted">{o.desc}</p>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={ui.card}>
        <label className={ui.label}>
          প্ল্যানের মেয়াদ কতদিনের? <span className="ml-1 rounded bg-accent/15 px-1.5 text-accent">সুপার অ্যাডমিন</span>
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {DURATION_PRESETS.map((p) => (
            <button
              key={p.days}
              type="button"
              onClick={() => setDays(p.days)}
              className={`rounded-full border px-3 py-1 text-xs ${
                days === p.days ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted hover:text-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_LEARNING_DAYS}
          max={MAX_LEARNING_DAYS}
          step={1}
          className={`${ui.input} max-w-40`}
          value={days}
          onChange={(e) => setDays(Math.min(MAX_LEARNING_DAYS, Math.max(MIN_LEARNING_DAYS, Number(e.target.value) || MIN_LEARNING_DAYS)))}
        />
        <p className="mt-1 text-xs text-muted">
          কাস্টম সংখ্যা দিন ({MIN_LEARNING_DAYS}–{MAX_LEARNING_DAYS} দিন), অথবা উপরের একটা বেছে নিন। তারপর নিচের যেকোনো একটা পদ্ধতি বেছে নিন।
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {OPTIONS.map((o) => (
          <Link key={o.href} href={`${o.href}?days=${days}`} className={`${ui.card} block transition hover:border-accent`}>
            <span className="text-2xl">{o.icon}</span>
            <p className="mt-2 font-semibold">{o.title}</p>
            <p className="mt-1 text-sm text-muted">{o.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
