"use client";

import { useState, useTransition } from "react";
import { takeBreak } from "@/lib/actions/plans";
import { ui } from "@/components/ui";

/** super_admin-only for now (see isSuperAdmin gate in actions/plans.ts#takeBreak). Lets the user
 * pick any custom number of days as a break starting today — those days show "বিরতি" in the
 * routine and everything after them shifts back by exactly that many days, nothing else changes. */
export function TakeBreakButton({ planId }: { planId: string }) {
  const [open, setOpen] = useState(false);
  const [days, setDays] = useState(2);
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

  return (
    <div className={`${ui.card} space-y-3`}>
      <p className="text-sm">
        কতদিনের ব্রেক নিতে চান? আজ থেকে এই কয়দিন রুটিনে &quot;বিরতি&quot; দেখাবে, এবং তারপরের সব কিছু ঠিক এই
        কয়দিন পিছিয়ে যাবে — আর কিছুই বদলাবে না।
      </p>
      <div className="flex items-center gap-3">
        <input
          type="number"
          min={1}
          max={60}
          value={days}
          onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
          className="w-20 rounded-md border border-border bg-background p-2 text-center"
        />
        <span className="text-sm text-muted">দিন</span>
      </div>
      <div className="flex gap-2">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              const r = await takeBreak(planId, days);
              if (!r.ok) setError(r.error);
              else setDone(true);
            })
          }
          className={`${ui.btn} ${ui.primary}`}
        >
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
