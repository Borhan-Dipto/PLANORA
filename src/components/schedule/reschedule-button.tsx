"use client";

import { useState, useTransition } from "react";
import { rescheduleMissed } from "@/lib/actions/schedule";
import { ui } from "@/components/ui";

export function RescheduleBanner({ planId, missed }: { planId: string; missed: number }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  if (!missed) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 p-3 sm:p-4">
      <p className="min-w-0 flex-1 basis-52 text-sm">
        ⚠️ আগের দিনগুলোর <b>{missed}টি</b> পড়া বাকি রয়ে গেছে। চাইলে বাকি দিনগুলোতে নতুন করে ভাগ করে দিই।
      </p>
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await rescheduleMissed(planId);
            if (!r.ok) setError(r.error);
          })
        }
        className={`${ui.btn} ${ui.primary} w-full sm:w-auto`}
      >
        {pending ? "সাজানো হচ্ছে…" : "↻ নতুন করে সাজাও"}
      </button>
      {error && <p className="w-full text-sm text-error">{error}</p>}
    </div>
  );
}
