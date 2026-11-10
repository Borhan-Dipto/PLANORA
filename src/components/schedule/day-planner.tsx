"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { planMyDay, unlockDay } from "@/lib/actions/schedule";
import { ui, fmtMinutes, DIFFICULTY_LABEL } from "@/components/ui";
import type { Difficulty } from "@/lib/plan/schema";

export type SubjectWithTopics = {
  id: string;
  name: string;
  topics: { id: string; name: string; difficulty: Difficulty; remaining: number }[];
};

type FlatTopic = {
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  difficulty: Difficulty;
  remaining: number;
};

/**
 * Lets the user pick, the night before (or that morning), exactly which topic(s) they'll study
 * that specific day and how many minutes each gets — for when the real class schedule is only
 * known then. A search box finds a topic across every subject; picking one adds it to that day's
 * list with an editable minute count. Saving locks the day so the automatic engine leaves it
 * alone; "অটোমেটিক-এ ফিরিয়ে দিন" hands it back. (The full topic-by-topic list with default time
 * estimates lives on the plan's এডিট পেজ — this page is just the quick nightly pick.)
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
  const flat: FlatTopic[] = useMemo(
    () =>
      subjects.flatMap((s) =>
        s.topics.map((t) => ({
          subjectId: s.id,
          subjectName: s.name,
          topicId: t.id,
          topicName: t.name,
          difficulty: t.difficulty,
          remaining: t.remaining,
        }))
      ),
    [subjects]
  );
  const byTopicId = useMemo(() => new Map(flat.map((f) => [f.topicId, f])), [flat]);

  const [picks, setPicks] = useState<{ topicId: string; minutes: number }[]>(() =>
    Object.entries(initialMinutes)
      .filter(([id, m]) => m > 0 && byTopicId.has(id))
      .map(([id, m]) => ({ topicId: id, minutes: m }))
  );
  const [query, setQuery] = useState("");
  const [showSearch, setShowSearch] = useState(() => !Object.values(initialMinutes).some((m) => m > 0));
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const router = useRouter();

  const pickedIds = new Set(picks.map((p) => p.topicId));
  const q = query.trim().toLowerCase();
  const results = q
    ? flat.filter((f) => !pickedIds.has(f.topicId) && `${f.topicName} ${f.subjectName}`.toLowerCase().includes(q)).slice(0, 8)
    : [];

  const addPick = (topicId: string) => {
    setPicks((p) => [...p, { topicId, minutes: 30 }]);
    setQuery("");
  };
  const removePick = (topicId: string) => setPicks((p) => p.filter((x) => x.topicId !== topicId));
  const setPickMinutes = (topicId: string, minutes: number) =>
    setPicks((p) => p.map((x) => (x.topicId === topicId ? { ...x, minutes: Math.max(0, minutes || 0) } : x)));

  const total = picks.reduce((n, p) => n + (p.minutes || 0), 0);

  const save = () => {
    setMsg(null);
    start(async () => {
      const allocations = picks
        .filter((p) => p.minutes > 0 && byTopicId.has(p.topicId))
        .map((p) => ({ subjectId: byTopicId.get(p.topicId)!.subjectId, topicId: p.topicId, minutes: p.minutes }));
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
      <p className="mt-1 text-xs text-muted">
        {picks.length
          ? "অটোমেটিক সিস্টেম এই টপিকগুলো ঠিক করে রেখেছে — আজকের ক্লাস রুটিন অনুযায়ী মিনিট বদলে নিন।"
          : "এই দিনের জন্য অটোমেটিক সিস্টেম এখনো কিছু ঠিক করেনি — নিচে থেকে টপিক খুঁজে যোগ করুন।"}
      </p>

      {picks.length > 0 && (
        <div className="mt-4 space-y-2">
          {picks.map((p) => {
            const f = byTopicId.get(p.topicId);
            if (!f) return null;
            return (
              <div key={p.topicId} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-sm">
                  {f.topicName}
                  <span className="ml-1.5 text-xs text-muted">({f.subjectName})</span>
                </span>
                <div className="w-20 shrink-0">
                  <input
                    type="number"
                    min={0}
                    step={5}
                    inputMode="numeric"
                    value={p.minutes}
                    onChange={(e) => setPickMinutes(p.topicId, Number(e.target.value))}
                    className={`${ui.input} text-right`}
                  />
                </div>
                <span className="shrink-0 text-xs text-muted">মি.</span>
                <button
                  type="button"
                  onClick={() => removePick(p.topicId)}
                  aria-label="বাদ দিন"
                  className="shrink-0 text-muted hover:text-error"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!showSearch ? (
        <button type="button" onClick={() => setShowSearch(true)} className="mt-3 text-sm text-accent">
          + আরেকটা টপিক যোগ করুন
        </button>
      ) : (
        <div className="relative mt-3">
          <input
            autoFocus={picks.length > 0}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="টপিক বা বিষয়ের নাম লিখে খুঁজুন…"
            className={ui.input}
          />
          {results.length > 0 && (
            <div className="absolute z-10 mt-1 w-full divide-y divide-border rounded-lg border border-border bg-surface shadow-lg">
              {results.map((f) => (
                <button
                  key={f.topicId}
                  type="button"
                  onClick={() => {
                    addPick(f.topicId);
                    setShowSearch(false);
                  }}
                  className="flex w-full items-center gap-2 p-2.5 text-left text-sm hover:bg-background"
                >
                  <span className="min-w-0 flex-1 truncate">{f.topicName}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {f.subjectName} · {DIFFICULTY_LABEL[f.difficulty]} · {fmtMinutes(f.remaining)} বাকি
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
