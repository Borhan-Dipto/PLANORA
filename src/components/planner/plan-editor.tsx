"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePlan } from "@/lib/actions/plans";
import {
  analyzePlan,
  newId,
  MIN_REVISION_DAYS,
  MAX_REVISION_DAYS,
  MIN_LEARNING_DAYS,
  MAX_LEARNING_DAYS,
  type PlanData,
  type Subject,
  type Topic,
} from "@/lib/plan/schema";
import { ui, DIFFICULTY_LABEL, WEEKDAY_LABEL, fmtMinutes } from "@/components/ui";
import { PlanStatsBar, IssueList } from "@/components/planner/plan-summary";
import { JsonImport } from "@/components/planner/json-import";

type Source = "manual" | "ai_chat" | "automatic";

const LEARNING_DAYS_PRESETS = [
  { days: 10, label: "১০ দিন" },
  { days: 15, label: "১৫ দিন" },
  { days: 30, label: "৩০ দিন (১ মাস)" },
  { days: 60, label: "৬০ দিন (২ মাস)" },
  { days: 90, label: "৯০ দিন (৩ মাস)" },
];

export function PlanEditor({
  initial,
  planId,
  source,
  isPremium,
  isSuperAdmin = false,
  active = false,
  todayIso,
}: {
  initial: PlanData;
  planId: string | null;
  source: Source;
  isPremium: boolean;
  /** Custom plan duration (learningDays) is a super_admin-only capability for now. */
  isSuperAdmin?: boolean;
  active?: boolean;
  /** Today's date (user's timezone) — active plans may only move their start date to today or later. */
  todayIso?: string;
}) {
  const router = useRouter();
  // Older stored plans predate per-subject weekdays — fill the default so the editor never sees undefined.
  const [plan, setPlan] = useState<PlanData>(() => ({
    ...initial,
    subjects: initial.subjects.map((s) => ({ ...s, weekdays: s.weekdays ?? [] })),
  }));
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [resetProgress, setResetProgress] = useState(false);
  // Raw text buffer for the custom learning-days field — kept separate from plan.learningDays so
  // clearing the box to type a fresh number (e.g. deleting "30" to type "40") doesn't get the
  // in-between empty state coerced straight to MIN_LEARNING_DAYS on every keystroke.
  const [daysText, setDaysText] = useState(String(initial.learningDays));
  const { issues, stats } = analyzePlan(plan);
  // Shown only when the user actually moves an active plan's start date — that's the exact
  // scenario the choice matters for ("১৫ তারিখ থেকে শুরু করেছিলাম, এখন ১৬ থেকে করব")।
  const startDateChanged = active && plan.startDate !== initial.startDate;

  const set = <K extends keyof PlanData>(k: K, v: PlanData[K]) => setPlan((p) => ({ ...p, [k]: v }));
  const setSubject = (id: string, fn: (s: Subject) => Subject) =>
    setPlan((p) => ({ ...p, subjects: p.subjects.map((s) => (s.id === id ? fn(s) : s)) }));

  const addSubject = () =>
    setPlan((p) => ({
      ...p,
      subjects: [...p.subjects, { id: newId(), name: "", course: "", priority: 3, weekdays: [], mandatory: false, topics: [] }],
    }));

  const save = () =>
    start(async () => {
      setError("");
      const res = await savePlan(
        planId,
        source,
        {
          ...plan,
          dailyTargets: (plan.dailyTargets ?? []).map((x) => x.trim()).filter(Boolean),
        },
        startDateChanged && resetProgress
      );
      if (!res.ok) return setError(res.error);
      router.push(`/planner/${res.id}`);
      router.refresh();
    });

  return (
    <div className="space-y-4 pb-24">
      {active && (
        <p className="rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm">
          ✎ চলমান প্ল্যান এডিট করছেন। সেভ করলে যা পড়া শেষ হয়েছে তা ঠিক থাকবে, আর আজ (বা নতুন শুরুর তারিখ) থেকে বাকি পড়া নতুন করে সাজানো হবে।
        </p>
      )}
      <JsonImport
        onImport={(imported) =>
          setPlan((p) => {
            const learningDays = isSuperAdmin ? imported.learningDays : p.learningDays;
            setDaysText(String(learningDays));
            return {
              ...imported,
              revisionDays: isPremium ? imported.revisionDays : p.revisionDays,
              learningDays,
            };
          })
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
              min={active ? todayIso : undefined}
              onChange={(e) => set("startDate", e.target.value)}
            />
            {active && (
              <p className="mt-1 text-xs text-muted">চলমান প্ল্যানের শুরুর তারিখ আজ বা তার পরে এগিয়ে দেওয়া যাবে — অতীতে নেওয়া যাবে না।</p>
            )}
            {startDateChanged && (
              <div className="mt-3 space-y-2 rounded-lg border border-warning/40 bg-warning/10 p-3">
                <p className="text-xs font-medium">শুরুর তারিখ পরিবর্তন করছেন — আগের সম্পন্ন করা পড়া কী করবেন?</p>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="resetProgress"
                    className="mt-1"
                    checked={!resetProgress}
                    onChange={() => setResetProgress(false)}
                  />
                  <span>যা শেষ হয়েছে তা কমপ্লিট হিসাবে থাকুক, বাকিটা নতুন তারিখ থেকে সাজিয়ে দিই</span>
                </label>
                <label className="flex items-start gap-2 text-sm">
                  <input
                    type="radio"
                    name="resetProgress"
                    className="mt-1"
                    checked={resetProgress}
                    onChange={() => setResetProgress(true)}
                  />
                  <span>না, একদম শুরু থেকে শুরু করব (আগের সব অগ্রগতি মুছে নতুন করে সাজানো হবে)</span>
                </label>
              </div>
            )}
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
          {isSuperAdmin && (
            <div className="sm:col-span-2">
              <label className={ui.label}>
                প্ল্যানের মেয়াদ (দিন) <span className="ml-1 rounded bg-accent/15 px-1.5 text-accent">সুপার অ্যাডমিন</span>
              </label>
              <div className="mb-2 flex flex-wrap gap-1.5">
                {LEARNING_DAYS_PRESETS.map((p) => (
                  <button
                    key={p.days}
                    type="button"
                    onClick={() => {
                      set("learningDays", p.days);
                      setDaysText(String(p.days));
                    }}
                    className={`rounded-full border px-3 py-1 text-xs ${
                      plan.learningDays === p.days
                        ? "border-accent bg-accent text-accent-foreground"
                        : "border-border text-muted hover:text-foreground"
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
                value={daysText}
                onChange={(e) => {
                  const v = e.target.value;
                  setDaysText(v);
                  // Let the number flow into the plan live while it's a valid in-range value, but
                  // don't fight the user mid-edit (empty box, a leading digit, etc.) — those get
                  // clamped once they leave the field, in onBlur below.
                  if (v !== "" && /^\d+$/.test(v)) {
                    const n = Number(v);
                    if (n >= MIN_LEARNING_DAYS && n <= MAX_LEARNING_DAYS) set("learningDays", n);
                  }
                }}
                onBlur={() => {
                  const clamped = Math.min(MAX_LEARNING_DAYS, Math.max(MIN_LEARNING_DAYS, Number(daysText) || plan.learningDays));
                  setDaysText(String(clamped));
                  set("learningDays", clamped);
                }}
              />
              <p className="mt-1 text-xs text-muted">
                কাস্টম সংখ্যা দিন ({MIN_LEARNING_DAYS}–{MAX_LEARNING_DAYS} দিন), অথবা উপরের একটা বেছে নিন।
              </p>
            </div>
          )}
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
          সাইকেল: {plan.learningDays} দিন পড়া + {plan.revisionDays} দিন রিভিশন = মোট {plan.learningDays + plan.revisionDays} দিন
          (শেষ: {stats.endDate})
        </p>
      </section>

      <PlanStatsBar stats={stats} />

      {/* Subjects — this is where topics/chapters with study time go */}
      <h2 className="pt-1 text-sm font-semibold text-muted">📚 বিষয় ও টপিক</h2>
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

      {/* Daily habits — intentionally separate from, and below, the subjects above. This box is
          NOT for topics/chapters (those go in a subject above, with their own study time) — it's
          only for small recurring daily habits with no time tracking, like reading a newspaper. */}
      <section className={ui.card}>
        <h2 className="font-semibold">🔁 দৈনিক অভ্যাস (ঐচ্ছিক)</h2>
        <p className="mt-1 text-xs text-muted">
          এটা বিষয়/টপিক দেওয়ার জায়গা না — উপরে &ldquo;বিষয় যোগ করুন&rdquo;-এ আপনার টপিকগুলো দিন। এখানে শুধু ছোট ছোট দৈনিক অভ্যাস
          লিখুন যেগুলোর আলাদা পড়ার সময় হিসাব করার দরকার নেই।
        </p>
        <label className={`${ui.label} mt-3`}>প্রতি লাইনে একটি অভ্যাস লিখুন</label>
        <textarea
          className={`${ui.input} min-h-20`}
          value={(plan.dailyTargets ?? []).join("\n")}
          placeholder={"প্রতিদিন English Newspaper পড়া\nপ্রতিদিন এক পৃষ্ঠা বাংলা লেখা"}
          onChange={(e) => set("dailyTargets", e.target.value.split("\n").slice(0, 20))}
          onBlur={() => set("dailyTargets", (plan.dailyTargets ?? []).map((x) => x.trim()).filter(Boolean))}
        />
      </section>

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
  // Topic array order = study order (buildSchedule always consumes topics[0] first per subject),
  // so moving a topic up/down here is the whole feature — no separate "order" field needed.
  const moveTopic = (id: string, dir: -1 | 1) =>
    onChange((s) => {
      const i = s.topics.findIndex((t) => t.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= s.topics.length) return s;
      const topics = [...s.topics];
      [topics[i], topics[j]] = [topics[j], topics[i]];
      return { ...s, topics };
    });
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
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={subject.mandatory ?? false}
            onChange={(e) => onChange((s) => ({ ...s, mandatory: e.target.checked }))}
          />
          <span>
            ✅ এই বিষয়টা <b>অবশ্যই</b> পড়তে হবে — প্রতিদিন (বা বাছাই করা দিনে) এটাকে সবার আগে জায়গা দেওয়া হবে, অন্য বিষয়ের
            কারণে এটা বাদ পড়বে না
          </span>
        </label>
      </div>

      <div className="mt-4 space-y-2">
        {subject.topics.map((t, i) => (
          <TopicRow
            key={t.id}
            index={i}
            topic={t}
            canMoveUp={i > 0}
            canMoveDown={i < subject.topics.length - 1}
            onMoveUp={() => moveTopic(t.id, -1)}
            onMoveDown={() => moveTopic(t.id, 1)}
            onChange={(patch) => setTopic(t.id, patch)}
            onRemove={() => onChange((s) => ({ ...s, topics: s.topics.filter((x) => x.id !== t.id) }))}
          />
        ))}
        {subject.topics.length > 1 && (
          <p className="text-xs text-muted">↕️ টপিকের ক্রম = পড়ার ক্রম — উপর-নিচ বাটনে সাজিয়ে নিন কোনটা আগে পড়বেন</p>
        )}
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

/**
 * One topic's editor row — split into a clearly-labelled name line and a settings line (কঠিনতা /
 * সময়) so it's obvious at a glance which box is for the time. The minutes field keeps its own raw
 * text buffer (same fix as the super-admin learning-days field) so clearing it to type a new
 * number doesn't get coerced back to a default mid-keystroke.
 */
function TopicRow({
  index,
  topic,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onChange,
  onRemove,
}: {
  index: number;
  topic: Topic;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onChange: (patch: Partial<Topic>) => void;
  onRemove: () => void;
}) {
  const [minutesText, setMinutesText] = useState(String(topic.estimatedMinutes));

  return (
    <div className="rounded-lg bg-background p-2.5">
      <div className="flex items-center gap-2">
        <span className="w-5 shrink-0 text-center text-xs text-muted">{index + 1}</span>
        <div className="flex shrink-0 flex-col">
          <button
            type="button"
            disabled={!canMoveUp}
            onClick={onMoveUp}
            aria-label="টপিক উপরে নিন"
            className="flex h-4 w-5 items-center justify-center rounded text-[10px] leading-none text-muted hover:bg-border disabled:opacity-25"
          >
            ▲
          </button>
          <button
            type="button"
            disabled={!canMoveDown}
            onClick={onMoveDown}
            aria-label="টপিক নিচে নিন"
            className="flex h-4 w-5 items-center justify-center rounded text-[10px] leading-none text-muted hover:bg-border disabled:opacity-25"
          >
            ▼
          </button>
        </div>
        <input
          className={`${ui.input} flex-1`}
          value={topic.name}
          maxLength={200}
          placeholder="টপিক / অধ্যায়ের নাম"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <button type="button" onClick={onRemove} className={`${ui.btn} ${ui.ghost} shrink-0 px-2`} aria-label="টপিক মুছুন">
          ✕
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-3 pl-7">
        <div>
          <label className="mb-1 block text-[11px] text-muted">কঠিনতা</label>
          <select
            className={`${ui.input} w-28`}
            value={topic.difficulty}
            onChange={(e) => onChange({ difficulty: e.target.value as Topic["difficulty"] })}
          >
            {(Object.keys(DIFFICULTY_LABEL) as Topic["difficulty"][]).map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-[11px] text-muted">⏱️ পড়তে কত মিনিট লাগবে</label>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              inputMode="numeric"
              min={10}
              max={1200}
              step={10}
              className={`${ui.input} w-24`}
              value={minutesText}
              aria-label="আনুমানিক মিনিট"
              onChange={(e) => {
                const v = e.target.value;
                setMinutesText(v);
                if (v !== "" && /^\d+$/.test(v)) {
                  const n = Number(v);
                  if (n >= 10 && n <= 1200) onChange({ estimatedMinutes: n });
                }
              }}
              onBlur={() => {
                const clamped = Math.min(1200, Math.max(10, Number(minutesText) || topic.estimatedMinutes));
                setMinutesText(String(clamped));
                onChange({ estimatedMinutes: clamped });
              }}
            />
            <span className="text-xs text-muted">মিনিট</span>
          </div>
        </div>
      </div>
    </div>
  );
}
