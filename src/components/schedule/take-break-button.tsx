"use client";

import { useState, useTransition } from "react";
import { takeBreak } from "@/lib/actions/plans";
import { ui } from "@/components/ui";

type Mode = "today" | "tomorrow" | "range";

function addDaysIso(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** super_admin-only for now (see isSuperAdmin gate in actions/plans.ts#takeBreak). Three ways to
 * say "when": running-date ("আজ থেকে"), day-before confirmation ("আগামীকাল থেকে" N দিন), or an
 * explicit calendar range — all three resolve to the same startDate/endDate server action call.
 * Those days show "বিরতি" in the routine and everything after them shifts back by exactly that
 * many days, nothing else changes. */
export function TakeBreakButton({ planId, today }: { planId: string; today: string }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("today");
  const [days, setDays] = useState(2);
  const tomorrow = addDaysIso(today, 1);
  const [rangeStart, setRangeStart] = useState(tomorrow);
  const [rangeEnd, setRangeEnd] = useState(tomorrow);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="rounded-xl border border-success/40 bg-success/10 p-3 text-sm">
        🌴 ব্রেক যোগ হয়েছে — রুটিন অটোমেটিক পিছিয়ে দেওয়া হয়েছে।
      </p>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`${ui.card} flex w-full items-center justify-between text-left hover:border-accent`}
      >
        <span className="text-sm">🌴 কিছুদিন ব্রেক নিন (রুটিন অটোমেটিক পিছিয়ে যাবে)</span>
        <span className="text-accent">→</span>
      </button>
    );
  }

  const submit = (startDate: string, endDate: string) => {
    setError("");
    start(async () => {
      const r = await takeBreak(planId, startDate, endDate);
      if (!r.ok) setError(r.error);
      else setDone(true);
    });
  };

  const confirm = () => {
    if (mode === "today") submit(today, addDaysIso(today, days - 1));
    else if (mode === "tomorrow") submit(tomorrow, addDaysIso(tomorrow, days - 1));
    else submit(rangeStart, rangeEnd);
  };

  return (
    <div className={`${ui.card} space-y-3`}>
      <p className="text-sm">
        কবে থেকে কবে পর্যন্ত ব্রেক তা নিচে বেছে নিন। ওই দিনগুলোয় রুটিনে &quot;বিরতি&quot; দেখাবে, আর তারপরের সব
        কিছু ঠিক তত দিন পিছিয়ে যাবে — আর কিছুই বদলাবে না।
      </p>

      <div className="flex flex-wrap gap-2 text-sm">
        {(["today", "tomorrow", "range"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-lg border px-3 py-1.5 ${mode === m ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"}`}
          >
            {m === "today" ? "আজ থেকে" : m === "tomorrow" ? "আগামীকাল থেকে" : "তারিখ বেছে নিন"}
          </button>
        ))}
      </div>

      {mode !== "range" ? (
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={1}
            max={60}
            value={days}
            onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            className="w-20 rounded-md border border-border bg-background p-2 text-center"
          />
          <span className="text-sm text-muted">দিন {mode === "today" ? "(আজ থেকে)" : "(আগামীকাল থেকে)"}</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-muted">
            শুরু
            <input
              type="date"
              min={today}
              value={rangeStart}
              onChange={(e) => {
                setRangeStart(e.target.value);
                if (e.target.value > rangeEnd) setRangeEnd(e.target.value);
              }}
              className="ml-2 rounded-md border border-border bg-background p-2"
            />
          </label>
          <label className="text-sm text-muted">
            শেষ
            <input
              type="date"
              min={rangeStart}
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              className="ml-2 rounded-md border border-border bg-background p-2"
            />
          </label>
        </div>
      )}

      <div className="flex gap-2">
        <button disabled={pending} onClick={confirm} className={`${ui.btn} ${ui.primary}`}>
          {pending ? "হচ্ছে…" : "ব্রেক নিশ্চিত করুন"}
        </button>
        <button onClick={() => setOpen(false)} disabled={pending} className={ui.btn}>
          বাতিল
        </button>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
