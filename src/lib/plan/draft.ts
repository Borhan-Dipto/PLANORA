import { z } from "zod";
import { emptyPlan, newId, type PlanData } from "./schema";

/** Loose shape the AI returns; normalised into strict PlanData by draftToPlan. */
export const aiDraftSchema = z.object({
  title: z.string().catch(""),
  goal: z.string().catch(""),
  examDate: z.string().catch(""),
  dailyStudyMinutes: z.number().catch(0),
  subjects: z
    .array(
      z.object({
        name: z.string().catch(""),
        priority: z.number().catch(3),
        topics: z
          .array(
            z.object({
              name: z.string().catch(""),
              difficulty: z.enum(["easy", "medium", "hard"]).catch("medium"),
              estimatedMinutes: z.number().catch(60),
            })
          )
          .catch([]),
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
  return {
    ...base,
    title: d.title.trim().slice(0, 120) || "আমার স্টাডি প্ল্যান",
    goal: d.goal.trim().slice(0, 500),
    examDate: /^\d{4}-\d{2}-\d{2}$/.test(d.examDate) ? d.examDate : "",
    dailyStudyMinutes: d.dailyStudyMinutes > 0 ? clamp(d.dailyStudyMinutes, 30, 720) : base.dailyStudyMinutes,
    subjects: d.subjects
      .filter((s) => s.name.trim())
      .slice(0, 30)
      .map((s) => ({
        id: newId(),
        name: s.name.trim().slice(0, 120),
        priority: clamp(s.priority, 1, 5),
        topics: s.topics
          .filter((t) => t.name.trim())
          .slice(0, 200)
          .map((t) => ({
            id: newId(),
            name: t.name.trim().slice(0, 200),
            difficulty: t.difficulty,
            estimatedMinutes: clamp(t.estimatedMinutes, 10, 1200),
          })),
      })),
  };
}
