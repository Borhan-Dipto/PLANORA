"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { planMyDay, unlockDay } from "@/lib/actions/schedule";
import { ui, fmtMinutes } from "@/components/ui";

type Subject = { id: string; name: string };

/**
 * Lets the user fix today's or tomorrow's per-subject study time by hand — for when the real
 * class schedule (how long each class actually ran) is only known that morning. Saving locks the
 * day so the automatic engine leaves it alone; "অটোমেটিক-এ ফিরিয়ে দিন" hands it back.
 */
export function DayPlanner({
  planId,
  date,
  dateLabel,
  subjects,
  initialMinutes,
  locked,
  dailyStudyMinutes,
}: {
  planId: string;
  date: string;
  dateLabel: string;
  subjects: Subject[];
  initialMinutes: Record<string, number>;
  locked: boolean;
  dailyStudyMinutes: number;
}) {
  const [minutes, setMinutes] = useState<Record<string, number>>(initialMinutes);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const router = useRouter();

  const total = Object.values(minutes).reduce((n, m) => n + (m || 0), 0);

  const save = () => {
    setMsg(null);
    start(async () => {
      const allocations = subjects.map((s) => ({ subjectId: s.id, minutes: Number(minutes[s.id]) || 0 }));
      const r = await planMyDay(planId, date, allocations);
      if (r.ok) {
        setMsg({ type: "ok", text: "✓ আজকের সময় ফিক্সড হয়ে গেছে — অটোমেটিক সিস্টেম আর এই দিনটা পরিবর্তন করবে না।" });
        router.refresh();
      } else setMsg({ type: "error", text: r.error });
    });
  };

  const reset = () => {
    setMsg(null);
    start(async () => {
      const r = await unlockDay(planId, date);
      if (r.ok) {
        setMsg({ type: "ok", text: "✓ অটোমেটিক টাইম ডিস্ট্রিবিউশনে ফিরে গেছে।" });
        router.refresh();
      } else setMsg({ type: "error", text: r.error });
    });
  };

  return (
    <div className={ui.card}>
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">{dateLabel}</h2>
        {locked && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">🔒 ম্যানুয়াল</span>}
      </div>
      <p className="mt-1 text-xs text-muted">আজকের ক্লাস রুটিন দেখে প্রতিটা বিষয়ে কত মিনিট পড়বেন তা ঠিক করুন।</p>

      <div className="mt-4 space-y-2">
        {subjects.map((s) => (
          <div key={s.id} className="flex items-center gap-3">
            <span className="min-w-0 flex-1 truncate text-sm">{s.name}</span>
            <div className="w-20 shrink-0">
              <input
                type="number"
                min={0}
                step={5}
                inputMode="numeric"
                value={minutes[s.id] ?? 0}
                onChange={(e) => setMinutes((m) => ({ ...m, [s.id]: Math.max(0, Number(e.target.value) || 0) }))}
                className={`${ui.input} text-right`}
              />
            </div>
            <span className="shrink-0 text-xs text-muted">মি.</span>
          </div>
        ))}
      </div>

      <p className="mt-3 text-xs text-muted">
        মোট: {fmtMinutes(total)}
        {dailyStudyMinutes ? ` · পরিকল্পিত: ${fmtMinutes(dailyStudyMinutes)}` : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={pending || !total} onClick={save} className={`${ui.btn} ${ui.primary}`}>
          {pending ? "সেভ হচ্ছে…" : "এই দিনের সময় ফিক্সড করুন"}
        </button>
        {locked && (
          <button disabled={pending} onClick={reset} className={`${ui.btn} ${ui.secondary}`}>
            অটোমেটিক-এ ফিরিয়ে দিন
          </button>
        )}
      </div>
      {msg && <p className={`mt-2 text-sm ${msg.type === "ok" ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </div>
  );
}
