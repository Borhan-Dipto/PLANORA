"use client";

import { useState, useTransition } from "react";
import { cancelBreak } from "@/lib/actions/plans";
import { ui } from "@/components/ui";

/** super_admin-only, shown only when the plan has an upcoming (today-or-later) break — lets it
 * be undone: the break dates are removed and the schedule regenerates with real content again. */
export function CancelBreakButton({ planId, dates }: { planId: string; dates: string[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return <p className="rounded-xl border border-success/40 bg-success/10 p-3 text-sm">ব্রেক বাতিল হয়েছে — রুটিন আগের মতো ফিরে এসেছে।</p>;
  }

  const first = dates[0];
  const last = dates[dates.length - 1];
  const label = first === last ? first : `${first} – ${last}`;

  return (
    <div className={`${ui.card} space-y-2`}>
      <p className="text-sm">🌴 ব্রেক নির্ধারিত আছে: <b>{label}</b> ({dates.length} দিন)</p>
      <div className="flex items-center gap-2">
        <button
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError("");
              const r = await cancelBreak(planId);
              if (!r.ok) setError(r.error);
              else setDone(true);
            })
          }
          className={`${ui.btn} ${ui.danger}`}
        >
          {pending ? "বাতিল হচ্ছে…" : "ব্রেক বাতিল করুন"}
        </button>
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
