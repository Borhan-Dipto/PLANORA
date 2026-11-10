"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { planMyDay, unlockDay } from "@/lib/actions/schedule";
import { ui, fmtMinutes, DIFFICULTY_LABEL } from "@/components/ui";
import type { Difficulty } from "@/lib/plan/schema";

export type SubjectWithTopics = {
  id: string;
  name: string;
  topics: { id: string; name: string; difficulty: Difficulty; remaining: number }[];
};

/**
 * Lets the user fix today's or tomorrow's study time topic-by-topic — for when the real class
 * schedule is only known that morning, and simply assigning a subject a block of time isn't
 * enough: the user needs to see and choose exactly which topic that time goes to. Saving locks
 * the day so the automatic engine leaves it alone; "অটোমেটিক-এ ফিরিয়ে দিন" hands it back.
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
  subjects: SubjectWithTopics[];
  initialMinutes: Record<string, number>;
  locked: boolean;
  dailyStudyMinutes: number;
}) {
  const [minutes, setMinutes] = useState<Record<string, number>>(initialMinutes);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const router = useRouter();

  const total = Object.values(minutes).reduce((n, m) => n + (m || 0), 0);
  const subjectTotal = (s: SubjectWithTopics) => s.topics.reduce((n, t) => n + (minutes[t.id] || 0), 0);

  const setTopic = (topicId: string, value: number) =>
    setMinutes((m) => ({ ...m, [topicId]: Math.max(0, value || 0) }));

  const save = () => {
    setMsg(null);
    start(async () => {
      const allocations = subjects.flatMap((s) =>
        s.topics
          .filter((t) => (minutes[t.id] || 0) > 0)
          .map((t) => ({ subjectId: s.id, topicId: t.id, minutes: minutes[t.id] }))
      );
      const r = await planMyDay(planId, date, allocations);
      if (r.ok) {
        setMsg({ type: "ok", text: "✓ আজকের টপিক ও সময় ফিক্সড হয়ে গেছে — অটোমেটিক সিস্টেম আর এই দিনটা পরিবর্তন করবে না।" });
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
      <p className="mt-1 text-xs text-muted">বিষয়ের নামে ক্লিক করে খুলুন, তারপর ঠিক কোন টপিক আজ পড়বেন সেটা বেছে সময় দিন।</p>

      <div className="mt-4 space-y-2">
        {subjects.map((s) => {
          const sTotal = subjectTotal(s);
          return (
            <details key={s.id} open={sTotal > 0} className="rounded-lg border border-border">
              <summary className="flex cursor-pointer list-none items-center gap-2 p-3 select-none">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{s.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {sTotal > 0 ? `${fmtMinutes(sTotal)} নির্ধারিত` : `${s.topics.length} টপিক বাকি`}
                </span>
              </summary>
              <div className="max-h-80 space-y-2 overflow-y-auto border-t border-border p-3">
                {s.topics.map((t) => (
                  <div key={t.id} className="flex items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm">
                      {t.name}
                      <span className="ml-1.5 text-xs text-muted">
                        ({DIFFICULTY_LABEL[t.difficulty]} · {fmtMinutes(t.remaining)} বাকি)
                      </span>
                    </span>
                    <div className="w-20 shrink-0">
                      <input
                        type="number"
                        min={0}
                        step={5}
                        inputMode="numeric"
                        value={minutes[t.id] ?? 0}
                        onChange={(e) => setTopic(t.id, Number(e.target.value))}
                        className={`${ui.input} text-right`}
                      />
                    </div>
                    <span className="shrink-0 text-xs text-muted">মি.</span>
                  </div>
                ))}
              </div>
            </details>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-muted">
        মোট: {fmtMinutes(total)}
        {dailyStudyMinutes ? ` · পরিকল্পিত: ${fmtMinutes(dailyStudyMinutes)}` : ""}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button disabled={pending || !total} onClick={save} className={`${ui.btn} ${ui.primary}`}>
          {pending ? "সেভ হচ্ছে…" : "এই দিনের টপিক ও সময় ফিক্সড করুন"}
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
