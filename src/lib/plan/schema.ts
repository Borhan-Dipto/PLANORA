import { z } from "zod";

/** Internal versioned plan format (v1). Every planner (manual / AI chat / automatic) produces this. */
export const PLAN_SCHEMA_VERSION = 1;
export const LEARNING_DAYS = 30;
export const FREE_REVISION_DAYS = 3;
export const MIN_REVISION_DAYS = 3;
export const MAX_REVISION_DAYS = 10;

export const difficultySchema = z.enum(["easy", "medium", "hard"]);
export type Difficulty = z.infer<typeof difficultySchema>;

export const topicSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "টপিকের নাম দিন").max(200),
  difficulty: difficultySchema.default("medium"),
  estimatedMinutes: z.coerce.number().int().min(10).max(1200).default(60),
});

export const subjectSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1, "বিষয়ের নাম দিন").max(120),
  /** Optional course / batch name, e.g. "Complete 40 Lecture Course" */
  course: z.string().trim().max(200).optional().default(""),
  priority: z.coerce.number().int().min(1).max(5).default(3),
  /** 0 = Sunday … 6 = Saturday. Empty ⇒ every one of the plan's own study days ("প্রতিদিন"). */
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional().default([]),
  topics: z.array(topicSchema).max(300),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ সঠিক নয়");

export const planDataSchema = z.object({
  version: z.literal(PLAN_SCHEMA_VERSION),
  title: z.string().trim().min(1, "প্ল্যানের নাম দিন").max(120),
  goal: z.string().trim().max(500).optional().default(""),
  startDate: isoDate,
  examDate: isoDate.optional().or(z.literal("")).default(""),
  learningDays: z.literal(LEARNING_DAYS),
  revisionDays: z.coerce.number().int().min(MIN_REVISION_DAYS).max(MAX_REVISION_DAYS),
  dailyStudyMinutes: z.coerce.number().int().min(30, "দিনে কমপক্ষে ৩০ মিনিট").max(720, "দিনে সর্বোচ্চ ১২ ঘণ্টা"),
  /** 0 = Sunday … 6 = Saturday */
  studyWeekdays: z.array(z.number().int().min(0).max(6)).min(1, "অন্তত একটি দিন বাছুন").max(7),
  subjects: z.array(subjectSchema).max(30),
  /** Recurring daily habits, e.g. "প্রতিদিন English Newspaper পড়া" */
  dailyTargets: z.array(z.string().trim().min(1).max(200)).max(20).optional().default([]),
});

export type PlanData = z.infer<typeof planDataSchema>;
export type Subject = z.infer<typeof subjectSchema>;
export type Topic = z.infer<typeof topicSchema>;

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function emptyPlan(): PlanData {
  return {
    version: PLAN_SCHEMA_VERSION,
    title: "",
    goal: "",
    startDate: todayIso(),
    examDate: "",
    learningDays: LEARNING_DAYS,
    revisionDays: FREE_REVISION_DAYS,
    dailyStudyMinutes: 180,
    studyWeekdays: [0, 1, 2, 3, 4, 5, 6],
    subjects: [],
    dailyTargets: [],
  };
}

export type PlanIssue = { level: "error" | "warning"; message: string };

/** Missing-information + feasibility detection shared by all planners and the preview. */
export function analyzePlan(plan: PlanData): { issues: PlanIssue[]; stats: PlanStats } {
  const issues: PlanIssue[] = [];
  const stats = planStats(plan);

  // Defensive: a plan row saved by an older/different code path (or a partially-failed AI
  // generation) can have planData that doesn't fully match the current shape — e.g. a missing
  // `subjects` array. Treat those as empty rather than throwing, so viewing such a plan degrades
  // to "no subjects yet" instead of a hard crash.
  const subjects = plan.subjects ?? [];
  if (!plan.title.trim()) issues.push({ level: "error", message: "প্ল্যানের নাম নেই" });
  if (subjects.length === 0) issues.push({ level: "error", message: "কোনো বিষয় যোগ করা হয়নি" });
  for (const s of subjects) {
    const topics = s.topics ?? [];
    if (topics.length === 0) issues.push({ level: "error", message: `"${s.name}" বিষয়ে কোনো টপিক নেই` });
    // Plans saved before per-subject weekdays existed have no `weekdays` in their stored JSON.
    const days = s.weekdays ?? [];
    if (days.length && !days.some((w) => plan.studyWeekdays.includes(w))) {
      issues.push({ level: "warning", message: `"${s.name}"-এর বাছাই করা দিনগুলো প্ল্যানের পড়ার দিনের সাথে মিলছে না` });
    }
  }
  if (plan.examDate && plan.examDate < plan.startDate) {
    issues.push({ level: "error", message: "পরীক্ষার তারিখ শুরুর তারিখের আগে" });
  }
  if (plan.examDate) {
    const cycleEnd = addDays(plan.startDate, plan.learningDays + plan.revisionDays - 1);
    if (plan.examDate < cycleEnd) {
      issues.push({ level: "warning", message: `পরীক্ষা (${plan.examDate}) সাইকেল শেষ হওয়ার (${cycleEnd}) আগে` });
    }
  }
  if (stats.totalTopics > 0 && stats.loadPercent > 100) {
    issues.push({
      level: "warning",
      message: `পড়ার পরিমাণ সময়ের চেয়ে বেশি (${stats.loadPercent}%) — দৈনিক সময় বাড়ান বা টপিক কমান`,
    });
  }
  return { issues, stats };
}

export type PlanStats = {
  totalTopics: number;
  totalMinutes: number;
  studyDayCount: number;
  availableMinutes: number;
  loadPercent: number;
  endDate: string;
};

export function planStats(plan: PlanData): PlanStats {
  const subjects = plan.subjects ?? [];
  const studyWeekdays = plan.studyWeekdays ?? [];
  const totalTopics = subjects.reduce((n, s) => n + (s.topics ?? []).length, 0);
  const totalMinutes = subjects.reduce((n, s) => n + (s.topics ?? []).reduce((m, t) => m + t.estimatedMinutes, 0), 0);
  let studyDayCount = 0;
  for (let i = 0; i < plan.learningDays; i++) {
    const wd = new Date(addDays(plan.startDate, i) + "T00:00:00Z").getUTCDay();
    if (studyWeekdays.includes(wd)) studyDayCount++;
  }
  const availableMinutes = studyDayCount * plan.dailyStudyMinutes;
  return {
    totalTopics,
    totalMinutes,
    studyDayCount,
    availableMinutes,
    loadPercent: availableMinutes ? Math.round((totalMinutes / availableMinutes) * 100) : 0,
    endDate: addDays(plan.startDate, plan.learningDays + plan.revisionDays - 1),
  };
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
