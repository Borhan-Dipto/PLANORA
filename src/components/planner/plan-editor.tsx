"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePlan } from "@/lib/actions/plans";
import {
  analyzePlan,
  newId,
  MIN_REVISION_DAYS,
  MAX_REVISION_DAYS,
  type PlanData,
  type Subject,
  type Topic,
} from "@/lib/plan/schema";
import { ui, DIFFICULTY_LABEL, WEEKDAY_LABEL, fmtMinutes } from "@/components/ui";
import { PlanStatsBar, IssueList } from "@/components/planner/plan-summary";
import { JsonImport } from "@/components/planner/json-import";

type Source = "manual" | "ai_chat" | "automatic";

export function PlanEditor({
  initial,
  planId,
  source,
  isPremium,
  active = false,
}: {
  initial: PlanData;
  planId: string | null;
  source: Source;
  isPremium: boolean;
  active?: boolean;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanData>(initial);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const { issues, stats } = analyzePlan(plan);

  const set = <K extends keyof PlanData>(k: K, v: PlanData[K]) => setPlan((p) => ({ ...p, [k]: v }));
  const setSubject = (id: string, fn: (s: Subject) => Subject) =>
    setPlan((p) => ({ ...p, subjects: p.subjects.map((s) => (s.id === id ? fn(s) : s)) }));

  const addSubject = () =>
    setPlan((p) => ({
      ...p,
      subjects: [...p.subjects, { id: newId(), name: "", course: "", priority: 3, weekdays: [], topics: [] }],
    }));

  const save = () =>
    start(async () => {
      setError("");
      const res = await savePlan(planId, source, {
        ...plan,
        dailyTargets: (plan.dailyTargets ?? []).map((x) => x.trim()).filter(Boolean),
      });
      if (!res.ok) return setError(res.error);
      router.push(`/planner/${res.id}`);
      router.refresh();
    });

  return (
    <div className="space-y-4 pb-24">
      {active && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm">
          ✎ চলমান প্ল্যান এডিট করছেন। সেভ করলে যা পড়া শেষ হয়েছে তা ঠিক থাকবে, আর আজ থেকে বাকি পড়া নতুন করে সাজানো হবে।
        </p>
      )}
      <JsonImport
        onImport={(imported) =>
          setPlan((p) => ({ ...imported, revisionDays: isPremium ? imported.revisionDays : p.revisionDays }))
        }
      />

      {/* Plan settings */}
      <section className={ui.card}>
        <h2 className="mb-4 font-semibold">প্ল্যানের তথ্য</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={ui.label}>প্ল্যানের নাম *</label>
            <input
              className={ui.input}
              value={plan.title}
              maxLength={120}
              placeholder="যেমন: ৪৭তম বিসিএস প্রিলি প্রস্তুতি"
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={ui.label}>লক্ষ্য (ঐচ্ছিক)</label>
            <input
              className={ui.input}
              value={plan.goal}
              maxLength={500}
              placeholder="এই ৩০ দিনে কী অর্জন করতে চান?"
              onChange={(e) => set("goal", e.target.value)}
            />
          </div>
          <div>
            <label className={ui.label}>শুরুর তারিখ *</label>
            <input
              type="date"
              className={ui.input}
              value={plan.startDate}
              disabled={active}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </div>
          <div>
            <label className={ui.label}>পরীক্ষার তারিখ (ঐচ্ছিক)</label>
            <input type="date" className={ui.input} value={plan.examDate} onChange={(e) => set("examDate", e.target.value)} />
          </div>
          <div>
            <label className={ui.label}>দৈনিক পড়ার সময় (ঘণ্টা) *</label>
            <input
              type="number"
              inputMode="decimal"
              min={0.5}
              max={12}
              step={0.5}
              className={ui.input}
              value={plan.dailyStudyMinutes / 60}
              onChange={(e) => set("dailyStudyMinutes", Math.round(Number(e.target.value || 0) * 60))}
            />
          </div>
          <div>
            <label className={ui.label}>
              রিভিশনের দিন {!isPremium && <span className="ml-1 rounded bg-warning/15 px-1.5 text-warning">Premium-এ ৩–১০</span>}
            </label>
            <select
              className={ui.input}
              disabled={!isPremium}
              value={plan.revisionDays}
              onChange={(e) => set("revisionDays", Number(e.target.value))}
            >
              {Array.from({ length: MAX_REVISION_DAYS - MIN_REVISION_DAYS + 1 }, (_, i) => i + MIN_REVISION_DAYS).map((n) => (
                <option key={n} value={n}>
                  {n} দিন
                </option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className={ui.label}>কোন কোন দিন পড়বেন *</label>
            <div className="flex flex-wrap gap-2">
              {WEEKDAY_LABEL.map((d, i) => {
                const on = plan.studyWeekdays.includes(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      set(
                        "studyWeekdays",
                        on ? plan.studyWeekdays.filter((x) => x !== i) : [...plan.studyWeekdays, i].sort()
                      )
                    }
                    className={`min-w-12 rounded-lg border px-3 py-1.5 text-sm ${
                      on ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs text-muted">
          সাইকেল: ৩০ দিন পড়া + {plan.revisionDays} দিন রিভিশন = মোট {30 + plan.revisionDays} দিন (শেষ: {stats.endDate})
        </p>
      </section>

      <section className={ui.card}>
        <label className={ui.label}>দৈনিক লক্ষ্য / অভ্যাস (প্রতি লাইনে একটি, ঐচ্ছিক)</label>
        <textarea
          className={`${ui.input} min-h-20`}
          value={(plan.dailyTargets ?? []).join("\n")}
          placeholder={"প্রতিদিন English Newspaper পড়া\nপ্রতিদিন এক পৃষ্ঠা বাংলা লেখা"}
          onChange={(e) => set("dailyTargets", e.target.value.split("\n").slice(0, 20))}
          onBlur={() => set("dailyTargets", (plan.dailyTargets ?? []).map((x) => x.trim()).filter(Boolean))}
        />
      </section>

      <PlanStatsBar stats={stats} />

      {/* Subjects */}
      {plan.subjects.map((s, idx) => (
        <SubjectCard
          key={s.id}
          index={idx}
          subject={s}
          onChange={(fn) => setSubject(s.id, fn)}
          onRemove={() => setPlan((p) => ({ ...p, subjects: p.subjects.filter((x) => x.id !== s.id) }))}
        />
      ))}

      <button type="button" onClick={addSubject} className={`${ui.btn} ${ui.secondary} w-full border-dashed py-3`}>
        + বিষয় যোগ করুন
      </button>

      <IssueList issues={issues} />

      {/* Sticky save bar — above mobile bottom nav */}
      <div className="fixed inset-x-0 bottom-16 z-20 border-t border-border bg-surface/95 p-3 backdrop-blur md:bottom-0 md:left-56">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-3">
          {error && <p className="min-w-0 flex-1 text-sm text-error">{error}</p>}
          <button onClick={save} disabled={pending} className={`${ui.btn} ${ui.primary} ml-auto w-full sm:w-auto`}>
            {pending ? "সেভ হচ্ছে…" : active ? "সেভ করে সময়সূচি আপডেট করুন" : "সেভ করে প্রিভিউ দেখুন"}
          </button>
        </div>
      </div>
    </div>
  );
}

function SubjectCard({
  index,
  subject,
  onChange,
  onRemove,
}: {
  index: number;
  subject: Subject;
  onChange: (fn: (s: Subject) => Subject) => void;
  onRemove: () => void;
}) {
  const [bulk, setBulk] = useState("");
  const [showBulk, setShowBulk] = useState(false);
  const total = subject.topics.reduce((n, t) => n + t.estimatedMinutes, 0);

  const setTopic = (id: string, patch: Partial<Topic>) =>
    onChange((s) => ({ ...s, topics: s.topics.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  const addTopics = (names: string[]) =>
    onChange((s) => ({
      ...s,
      topics: [
        ...s.topics,
        ...names.map((name) => ({ id: newId(), name, difficulty: "medium" as const, estimatedMinutes: 60 })),
      ],
    }));

  return (
    <section className={ui.card}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-0 flex-1 basis-48">
          <label className={ui.label}>বিষয় {index + 1}</label>
          <input
            className={ui.input}
            value={subject.name}
            maxLength={120}
            placeholder="যেমন: বাংলাদেশ বিষয়াবলি"
            onChange={(e) => onChange((s) => ({ ...s, name: e.target.value }))}
          />
        </div>
        <div className="min-w-0 flex-1 basis-48">
          <label className={ui.label}>কোর্স / ব্যাচ (ঐচ্ছিক)</label>
          <input
            className={ui.input}
            value={subject.course ?? ""}
            maxLength={200}
            placeholder="যেমন: Complete 40 Lecture Course"
            onChange={(e) => onChange((s) => ({ ...s, course: e.target.value }))}
          />
        </div>
        <div className="w-28">
          <label className={ui.label}>গুরুত্ব</label>
          <select
            className={ui.input}
            value={subject.priority}
            onChange={(e) => onChange((s) => ({ ...s, priority: Number(e.target.value) }))}
          >
            {[5, 4, 3, 2, 1].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}
              </option>
            ))}
          </select>
        </div>
        <button type="button" onClick={onRemove} className={`${ui.btn} ${ui.danger} px-3`} aria-label="বিষয় মুছুন">
          ✕
        </button>
      </div>

      <div className="mt-3">
        <label className={ui.label}>কোন কোন দিন পড়বেন</label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={subject.weekdays.length === 0}
            onClick={() => onChange((s) => ({ ...s, weekdays: [] }))}
            className={`rounded-lg border px-3 py-1.5 text-sm ${
              subject.weekdays.length === 0 ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted"
            }`}
          >
            প্রতিদিন
          </button>
          {WEEKDAY_LABEL.map((d, i) => {
            const on = subject.weekdays.includes(i);
            return (
              <button
                key={i}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onChange((s) => ({
                    ...s,
                    weekdays: on ? s.weekdays.filter((x) => x !== i) : [...s.weekdays, i].sort(),
                  }))
                }
                className={`min-w-12 rounded-lg border px-3 py-1.5 text-sm ${
                  on ? "border-accent bg-accent text-accent-foreground" : "border-border text-muted"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
        {subject.weekdays.length > 0 && (
          <p className="mt-1 text-xs text-muted">সপ্তাহে {subject.weekdays.length} দিন — বাকি দিনগুলোয় এই বিষয়টা আসবে না</p>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {subject.topics.map((t, i) => (
          <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-background p-2 sm:flex-nowrap">
            <span className="hidden w-6 text-center text-xs text-muted sm:block">{i + 1}</span>
            <input
              className={`${ui.input} basis-full sm:basis-auto sm:flex-1`}
              value={t.name}
              maxLength={200}
              placeholder="টপিক / অধ্যায়"
              onChange={(e) => setTopic(t.id, { name: e.target.value })}
            />
            <select
              className={`${ui.input} flex-1 sm:w-28 sm:flex-none`}
              value={t.difficulty}
              onChange={(e) => setTopic(t.id, { difficulty: e.target.value as Topic["difficulty"] })}
            >
              {(Object.keys(DIFFICULTY_LABEL) as Topic["difficulty"][]).map((d) => (
                <option key={d} value={d}>
                  {DIFFICULTY_LABEL[d]}
                </option>
              ))}
            </select>
            <div className="flex flex-1 items-center gap-1 sm:w-28 sm:flex-none">
              <input
                type="number"
                inputMode="numeric"
                min={10}
                max={1200}
                step={10}
                className={ui.input}
                value={t.estimatedMinutes}
                aria-label="আনুমানিক মিনিট"
                onChange={(e) => setTopic(t.id, { estimatedMinutes: Number(e.target.value || 0) })}
              />
              <span className="text-xs text-muted">মি.</span>
            </div>
            <button
              type="button"
              onClick={() => onChange((s) => ({ ...s, topics: s.topics.filter((x) => x.id !== t.id) }))}
              className={`${ui.btn} ${ui.ghost} px-2`}
              aria-label="টপিক মুছুন"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {showBulk && (
        <div className="mt-3">
          <textarea
            className={`${ui.input} min-h-28`}
            value={bulk}
            placeholder={"প্রতি লাইনে একটি টপিক লিখুন\nঅধ্যায় ১: ভৌত রাশি\nঅধ্যায় ২: গতি"}
            onChange={(e) => setBulk(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className={`${ui.btn} ${ui.primary}`}
              onClick={() => {
                const names = bulk.split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 100);
                if (names.length) addTopics(names);
                setBulk("");
                setShowBulk(false);
              }}
            >
              যোগ করুন
            </button>
            <button type="button" className={`${ui.btn} ${ui.ghost}`} onClick={() => setShowBulk(false)}>
              বাতিল
            </button>
          </div>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" className={`${ui.btn} ${ui.secondary}`} onClick={() => addTopics([""])}>
          + টপিক
        </button>
        {!showBulk && (
          <button type="button" className={`${ui.btn} ${ui.ghost}`} onClick={() => setShowBulk(true)}>
            একসাথে অনেকগুলো
          </button>
        )}
        <span className="ml-auto text-xs text-muted">
          {subject.topics.length} টপিক · {fmtMinutes(total)}
        </span>
      </div>
    </section>
  );
}
