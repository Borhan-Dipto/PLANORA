import { aiDraftSchema, draftToPlan } from "./draft";
import { MAX_REVISION_DAYS, MIN_REVISION_DAYS, type PlanData } from "./schema";

/**
 * PLANORA exchange format (what users import/export and what the master prompt asks chatbots to produce):
 * {
 *   plan_name, goal, learning_days: 30, exam_date?, daily_study_minutes?, study_weekdays?,
 *   subjects: [{ name, course?, priority?, topics: ["…" | { name, difficulty, estimated_minutes }] }],
 *   daily_targets?: { key: value } | ["…"],
 *   revision_phase?: { duration_days }
 * }
 */
export const MASTER_PROMPT = `তুমি একজন অভিজ্ঞ স্টাডি প্ল্যানার। আমি PLANORA অ্যাপে একটি ৩০ দিনের স্টাডি প্ল্যান ইমপোর্ট করব।
আমি নিচে বলছি কী কী পড়তে চাই — সেটা থেকে নিচের "PLANORA JSON" ফরম্যাটে একটি JSON বানিয়ে দাও।
শুধু JSON দেবে (একটি \`\`\`json কোড ব্লকে) — আগে-পরে কোনো ব্যাখ্যা নয়।

========== আমি যা পড়তে চাই ==========
[এখানে নিজের ভাষায় লিখুন — যেমন:
"৫৩তম বিসিএস প্রিলির প্রস্তুতি। বাংলার ৪০ ক্লাসের একটা কোর্স আর গণিতের জব ম্যাথ কোর্স শেষ করতে চাই (ক্লাস লিস্ট নিচে দিলাম)।
সাথে ৪০–৪৬তম বিসিএস প্রশ্নব্যাংক সমাধান, প্রতিদিন ইংরেজি পত্রিকা পড়ে সামারি লেখা আর এক পৃষ্ঠা বাংলা লেখা।
চাকরির পাশাপাশি পড়ি, দিনে ৩ ঘণ্টা সময় পাই। পরীক্ষা সম্ভবত ২০২৭-এর মার্চে।"
কোর্সের ক্লাস/লেকচার লিস্ট থাকলে হুবহু পেস্ট করে দিন।]
======================================

নিয়ম:
1. "plan_name": প্ল্যানের ছোট নাম। "goal": এই ৩০ দিনে কী অর্জন করতে চাই — এক-দুই বাক্যে।
2. "learning_days" সবসময় 30।
3. প্রতিটি বিষয়/কোর্স হবে "subjects"-এর একটি অবজেক্ট:
   - "name": বিষয় বা কোর্সের নাম (যেমন "বাংলা — ৩১তম বাংলা জব ব্যাচ")
   - "course": কোর্স/ব্যাচের নাম থাকলে, না থাকলে বাদ দাও
   - "priority": 1 (কম) থেকে 5 (সবচেয়ে বেশি) — বেশি নম্বরের বা দুর্বল বিষয়ে বেশি
   - "topics": পড়ার একক — ক্লাস, লেকচার, অধ্যায় বা সিলেবাস-অংশ — ক্রমানুসারে।
     আমি লিস্ট দিলে হুবহু সেই লিস্ট ও ক্রম রাখবে, নিজে থেকে বাদ দেবে না।
     লিস্ট না দিলে অফিসিয়াল সিলেবাস অনুযায়ী নিজে ভাগ করবে (প্রতি বিষয়ে সাধারণত ৫–১৫টি)।
   - কোনো টপিক বেশি কঠিন বা লম্বা হলে স্ট্রিং-এর বদলে অবজেক্ট দিতে পারো:
     { "name": "Logarithm", "difficulty": "hard", "estimated_minutes": 120 }
     ("difficulty" শুধু "easy" / "medium" / "hard"; "estimated_minutes" ১০–১২০০)
4. প্রতিদিনের অভ্যাস (পত্রিকা পড়া, লেখা অনুশীলন, প্রতিদিন কয়টা টপিক) "daily_targets"-এ দাও।
5. "daily_study_minutes": দিনে কত মিনিট পড়ব (৩০–৭২০)। জানা না থাকলে 180।
6. "exam_date": "YYYY-MM-DD", না জানলে ""। কখনো বানিয়ে লিখবে না।
7. "study_weekdays": কোন দিন পড়ব — 0=রবি, 1=সোম, 2=মঙ্গল, 3=বুধ, 4=বৃহস্পতি, 5=শুক্র, 6=শনি। না বললে সব দিন।
8. "revision_phase.duration_days": রিভিশনের দিন — 3, 5, 7 বা 10 (না বললে 3)।
9. আউটপুট অবশ্যই valid JSON হবে, ঠিক এই কাঠামোয়:

{
  "plan_name": "53rd BCS Monthly Preparation",
  "goal": "৩০ দিনের মধ্যে বাংলা ও গণিত কোর্স শেষ করা এবং বিগত প্রশ্নব্যাংক অনুশীলন",
  "learning_days": 30,
  "exam_date": "",
  "daily_study_minutes": 180,
  "study_weekdays": [0, 1, 2, 3, 4, 5, 6],
  "subjects": [
    {
      "name": "বাংলা — ৩১তম বাংলা জব ব্যাচ",
      "course": "Complete 40 Lecture Course",
      "priority": 5,
      "topics": [
        "ক্লাস-০১: বাংলা সাহিত্যের যুগ বিভাজন, চর্যাপদ",
        "ক্লাস-০২: অন্ধকার যুগ, শ্রীকৃষ্ণকীর্তন, বৈষ্ণব পদাবলী"
      ]
    },
    {
      "name": "গণিত — জব ম্যাথ কোর্স",
      "priority": 4,
      "topics": [
        "Number — Class 1",
        { "name": "Logarithm", "difficulty": "hard", "estimated_minutes": 120 }
      ]
    }
  ],
  "daily_targets": {
    "topics_per_day": "2-3",
    "english_newspaper_reading": "Daily",
    "bangla_writing": "One page daily"
  },
  "revision_phase": { "enabled": true, "duration_days": 3 }
}`;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const pick = (o: Obj, ...keys: string[]) => keys.map((k) => o[k]).find((v) => v !== undefined && v !== null);
const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : NaN);
const humanize = (k: string) => k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** Maps the exchange format (snake_case, string topics, …) and our own camelCase format to the draft shape. */
function normalise(raw: Obj) {
  const minutes = num(pick(raw, "daily_study_minutes", "dailyStudyMinutes"));
  const hours = num(pick(raw, "daily_study_hours", "dailyStudyHours"));
  const targetsRaw = pick(raw, "daily_targets", "dailyTargets");
  const dailyTargets = Array.isArray(targetsRaw)
    ? targetsRaw.map(str)
    : isObj(targetsRaw)
      ? Object.entries(targetsRaw).map(([k, v]) => `${humanize(k)}: ${str(v)}`)
      : [];
  const revision = pick(raw, "revision_phase", "revisionPhase");
  const revisionDays = num(isObj(revision) ? pick(revision, "duration_days", "durationDays") : pick(raw, "revision_days", "revisionDays"));
  const weekdays = pick(raw, "study_weekdays", "studyWeekdays");

  return {
    draft: {
      title: str(pick(raw, "plan_name", "planName", "title", "name")),
      goal: str(raw.goal),
      examDate: str(pick(raw, "exam_date", "examDate")),
      dailyStudyMinutes: Number.isFinite(minutes) ? minutes : Number.isFinite(hours) ? hours * 60 : 0,
      dailyTargets,
      subjects: (Array.isArray(raw.subjects) ? raw.subjects : []).filter(isObj).map((s) => ({
        name: str(pick(s, "name", "subject", "title")),
        course: str(s.course),
        priority: Number.isFinite(num(s.priority)) ? num(s.priority) : 3,
        topics: (Array.isArray(s.topics) ? s.topics : []).map((t) =>
          isObj(t)
            ? {
                name: str(pick(t, "name", "title", "topic")),
                difficulty: str(t.difficulty) || "medium",
                estimatedMinutes: num(pick(t, "estimated_minutes", "estimatedMinutes", "minutes")) || 0,
              }
            : str(t)
        ),
      })),
    },
    revisionDays: Number.isFinite(revisionDays) ? revisionDays : undefined,
    studyWeekdays: Array.isArray(weekdays) ? weekdays.map(num).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6) : [],
    startDate: str(pick(raw, "start_date", "startDate")),
  };
}

export type ImportResult = { ok: true; plan: PlanData; subjects: number; topics: number } | { ok: false; error: string };

/** Accepts raw JSON text (also tolerates ```json fences or text around the object). */
export function parsePlanJson(text: string): ImportResult {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return { ok: false, error: "JSON পাওয়া যায়নি — { } সহ পুরোটা দিন" };

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return { ok: false, error: "JSON ফরম্যাট ভুল — চ্যাটবটকে আবার valid JSON দিতে বলুন" };
  }
  if (!isObj(raw)) return { ok: false, error: "JSON-এর কাঠামো মিলছে না — মাস্টার প্রম্পট ব্যবহার করুন" };

  const n = normalise(raw);
  const plan = draftToPlan(aiDraftSchema.parse(n.draft));
  if (n.studyWeekdays.length) plan.studyWeekdays = [...new Set(n.studyWeekdays)].sort();
  if (/^\d{4}-\d{2}-\d{2}$/.test(n.startDate)) plan.startDate = n.startDate;
  if (n.revisionDays !== undefined)
    plan.revisionDays = Math.min(MAX_REVISION_DAYS, Math.max(MIN_REVISION_DAYS, Math.round(n.revisionDays)));

  const topics = plan.subjects.reduce((c, s) => c + s.topics.length, 0);
  if (!plan.subjects.length || !topics) return { ok: false, error: "JSON-এ কোনো বিষয় বা টপিক নেই" };
  return { ok: true, plan, subjects: plan.subjects.length, topics };
}

/** Plan → exchange format (for download / re-use in other chatbots). */
export function planToJson(plan: PlanData) {
  return {
    plan_name: plan.title,
    goal: plan.goal,
    learning_days: plan.learningDays,
    start_date: plan.startDate,
    exam_date: plan.examDate,
    daily_study_minutes: plan.dailyStudyMinutes,
    study_weekdays: plan.studyWeekdays,
    subjects: plan.subjects.map((s) => ({
      name: s.name,
      ...(s.course ? { course: s.course } : {}),
      priority: s.priority,
      topics: s.topics.map((t) =>
        t.difficulty === "medium" ? t.name : { name: t.name, difficulty: t.difficulty, estimated_minutes: t.estimatedMinutes }
      ),
    })),
    daily_targets: plan.dailyTargets ?? [],
    revision_phase: { enabled: true, duration_days: plan.revisionDays },
  };
}

export function downloadJson(plan: PlanData) {
  const blob = new Blob([JSON.stringify(planToJson(plan), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${(plan.title || "planora-plan").replace(/[\\/:*?"<>|]+/g, "-").slice(0, 60)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}
