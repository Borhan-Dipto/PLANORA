import { z } from "zod";
import { emptyPlan, newId, LEARNING_DAYS, type PlanData } from "./schema";

const topicIn = z.union([
  z.string().transform((name) => ({ name, difficulty: "medium" as const, estimatedMinutes: 0 })),
  z.object({
    name: z.string().catch(""),
    difficulty: z.enum(["easy", "medium", "hard"]).catch("medium"),
    /** 0 = unknown → filled evenly from the available study time */
    estimatedMinutes: z.number().catch(0),
  }),
]);

/** Loose plan shape produced by the AI or by an imported JSON; normalised by draftToPlan. */
export const aiDraftSchema = z.object({
  title: z.string().catch(""),
  goal: z.string().catch(""),
  examDate: z.string().catch(""),
  dailyStudyMinutes: z.number().catch(0),
  dailyTargets: z.array(z.string()).catch([]),
  subjects: z
    .array(
      z.object({
        name: z.string().catch(""),
        course: z.string().catch(""),
        priority: z.number().catch(3),
        topics: z.array(topicIn).catch([]),
      })
    )
    .catch([]),
});
export type AiDraft = z.infer<typeof aiDraftSchema>;

export const chatTurnSchema = z.object({
  reply: z.string().catch(""),
  ready: z.boolean().catch(false),
  missing: z.array(z.string()).catch([]),
  draft: aiDraftSchema,
});

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

export function draftToPlan(d: AiDraft): PlanData {
  const base = emptyPlan();
  const daily = d.dailyStudyMinutes > 0 ? clamp(d.dailyStudyMinutes, 30, 720) : base.dailyStudyMinutes;

  const subjects = d.subjects
    .filter((s) => s.name.trim())
    .slice(0, 30)
    .map((s) => ({
      id: newId(),
      name: s.name.trim().slice(0, 120),
      course: s.course.trim().slice(0, 200),
      priority: clamp(s.priority, 1, 5),
      topics: s.topics
        .filter((t) => t.name.trim())
        .slice(0, 300)
        .map((t) => ({
          id: newId(),
          name: t.name.trim().slice(0, 200),
          difficulty: t.difficulty,
          estimatedMinutes: t.estimatedMinutes > 0 ? clamp(t.estimatedMinutes, 10, 1200) : 0,
        })),
    }));

  // Topics without a time estimate share the remaining study time evenly (rounded to 5 min).
  const all = subjects.flatMap((s) => s.topics);
  const unknown = all.filter((t) => !t.estimatedMinutes);
  if (unknown.length) {
    const known = all.reduce((n, t) => n + t.estimatedMinutes, 0);
    const each = Math.max(0, daily * LEARNING_DAYS - known) / unknown.length;
    const minutes = clamp(Math.round(each / 5) * 5, 15, 240);
    unknown.forEach((t) => (t.estimatedMinutes = minutes));
  }

  return {
    ...base,
    title: d.title.trim().slice(0, 120) || "আমার স্টাডি প্ল্যান",
    goal: d.goal.trim().slice(0, 500),
    examDate: /^\d{4}-\d{2}-\d{2}$/.test(d.examDate) ? d.examDate : "",
    dailyStudyMinutes: daily,
    subjects,
    dailyTargets: d.dailyTargets.map((x) => x.trim().slice(0, 200)).filter(Boolean).slice(0, 20),
  };
}
