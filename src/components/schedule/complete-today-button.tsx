"use client";

import { useState, useTransition } from "react";
import { completeToday } from "@/lib/actions/schedule";
import { ui } from "@/components/ui";

/** super_admin-only for now (premium feature). For when today ran out of time with topics still
 * pending — clicking this moves whatever's left to tomorrow onward (cascading one day at a time
 * if tomorrow's own load is already full), via the exact same regenerateSchedule mechanism as
 * "নতুন করে সাজাও", just starting from tomorrow instead of today. */
export function CompleteTodayButton({ planId }: { planId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (done) {
    return (
      <p className="rounded-xl border border-success/40 bg-success/10 p-3 text-sm">
        ✅ আজকের বাকি পড়া পরের দিনগুলোতে সমন্বয় করে দেওয়া হয়েছে।
      </p>
    );
  }

  return (
    <div className={`${ui.card} space-y-2`}>
      <p className="text-sm">আজকের আর সময় না থাকলে, বাকি টপিকগুলো পরের দিনগুলোতে অটোমেটিক সমন্বয় করে নিতে পারেন।</p>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError("");
            const r = await completeToday(planId);
            if (!r.ok) setError(r.error);
            else setDone(true);
          })
        }
        className={`${ui.btn} ${ui.primary}`}
      >
        {pending ? "সমন্বয় হচ্ছে…" : "✅ আজকের পড়া কমপ্লিট ধরে নাও"}
      </button>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
