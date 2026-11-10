"use server";

import { and, eq, gte, count, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { plans, aiUsageLogs } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { analyzePlan, planDataSchema, FREE_REVISION_DAYS, todayIso, type PlanData } from "@/lib/plan/schema";
import { aiDraftSchema, chatTurnSchema, draftToPlan, type AiDraft } from "@/lib/plan/draft";
import { AiError, chatResponseSchema, draftResponseSchema, generateJson, type GeminiContent } from "@/lib/ai/gemini";
import { getUserTier, AI_DAILY_LIMIT } from "@/lib/plan/tier";
import { regenerateSchedule, todayFor } from "@/lib/schedule/service";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Source = "manual" | "ai_chat" | "automatic";

async function normalise(userId: string, input: unknown): Promise<Result<{ data: PlanData }>> {
  const parsed = planDataSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "তথ্য সঠিক নয়" };
  const data = parsed.data;
  // Free users: fixed 3 revision days. Premium: 3–10 (enforced by schema).
  if ((await getUserTier(userId)) === "free") data.revisionDays = FREE_REVISION_DAYS;
  return { ok: true, data };
}

async function insertDraft(userId: string, source: Source, data: PlanData) {
  const [row] = await db
    .insert(plans)
    .values({ userId, source, title: data.title, planData: data, startDate: data.startDate })
    .returning({ id: plans.id });
  revalidatePath("/planner");
  return row.id;
}

/** Create (planId = null) or update a draft or active plan. Editing an active plan reschedules from today. */
export async function savePlan(planId: string | null, source: Source, input: unknown): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  const n = await normalise(userId, input);
  if (!n.ok) return n;

  if (!planId) return { ok: true, id: await insertDraft(userId, source, n.data) };

  const [existing] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  if (!existing || (existing.status !== "draft" && existing.status !== "active"))
    return { ok: false, error: "এই প্ল্যানটি আর এডিট করা যায় না" };

  const data = n.data;
  if (existing.status === "active") {
    // The cycle has started — its dates are fixed; only the content changes.
    data.startDate = existing.planData.startDate;
    const blocking = analyzePlan(data).issues.find((i) => i.level === "error");
    if (blocking) return { ok: false, error: blocking.message };
  }

  await db
    .update(plans)
    .set({ title: data.title, planData: data, startDate: data.startDate, updatedAt: new Date() })
    .where(eq(plans.id, planId));
  if (existing.status === "active") {
    await regenerateSchedule(planId, userId, data, await todayFor(userId));
    revalidatePath("/dashboard");
    revalidatePath(`/planner/${planId}/schedule`);
  }
  revalidatePath(`/planner/${planId}`);
  return { ok: true, id: planId };
}

export async function approvePlan(planId: string): Promise<Result> {
  const userId = await requireUserId();
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  if (!plan || plan.status !== "draft") return { ok: false, error: "প্ল্যানটি পাওয়া যায়নি" };

  const { issues } = analyzePlan(plan.planData);
  const blocking = issues.find((i) => i.level === "error");
  if (blocking) return { ok: false, error: blocking.message };

  const [active] = await db
    .select({ c: count() })
    .from(plans)
    .where(and(eq(plans.userId, userId), eq(plans.status, "active"), ne(plans.id, planId)));
  if (active.c > 0) return { ok: false, error: "আপনার একটি চলমান প্ল্যান আছে। আগে সেটি আর্কাইভ করুন।" };

  // A draft whose start date has already passed starts today, so the full 30 days are available.
  const today = await todayFor(userId);
  const data = plan.planData.startDate < today ? { ...plan.planData, startDate: today } : plan.planData;
  await db
    .update(plans)
    .set({ status: "active", planData: data, startDate: data.startDate, approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(plans.id, planId));
  await regenerateSchedule(planId, userId, data, today);
  revalidatePath("/planner");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function archivePlan(planId: string): Promise<Result> {
  const userId = await requireUserId();
  await db
    .update(plans)
    .set({ status: "archived", updatedAt: new Date() })
    .where(and(eq(plans.id, planId), eq(plans.userId, userId), eq(plans.status, "active")));
  revalidatePath("/planner");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Permanently deletes a plan of any status — the user confirmed by retyping its title. Cascades
 * to its tasks and focus sessions. */
export async function deletePlan(planId: string): Promise<Result> {
  const userId = await requireUserId();
  const deleted = await db
    .delete(plans)
    .where(and(eq(plans.id, planId), eq(plans.userId, userId)))
    .returning({ id: plans.id });
  if (!deleted.length) return { ok: false, error: "প্ল্যানটি পাওয়া যায়নি" };
  revalidatePath("/planner");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Repeat a finished/archived cycle: copy it into a fresh draft starting today. */
export async function duplicatePlan(planId: string): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  const [plan] = await db.select().from(plans).where(and(eq(plans.id, planId), eq(plans.userId, userId)));
  if (!plan) return { ok: false, error: "প্ল্যানটি পাওয়া যায়নি" };
  const data = { ...plan.planData, startDate: todayIso(), title: `${plan.planData.title} (আবার)`.slice(0, 120) };
  return { ok: true, id: await insertDraft(userId, plan.source, data) };
}

/* ---------------- AI ---------------- */

async function checkQuota(userId: string): Promise<string | null> {
  const tier = await getUserTier(userId);
  const limit = AI_DAILY_LIMIT[tier];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [r] = await db
    .select({ c: count() })
    .from(aiUsageLogs)
    .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, since)));
  if (r.c < limit) return null;
  return tier === "free"
    ? `আজকের ফ্রি AI লিমিট (${limit}) শেষ। প্রিমিয়ামে আপগ্রেড করুন অথবা কাল আবার চেষ্টা করুন।`
    : `আজকের AI লিমিট (${limit}) শেষ। কাল আবার চেষ্টা করুন।`;
}

async function callAi(userId: string, feature: string, args: Parameters<typeof generateJson>[0]) {
  const out = await generateJson(args);
  await db.insert(aiUsageLogs).values({
    userId,
    feature,
    inputTokens: out.inputTokens,
    outputTokens: out.outputTokens,
  });
  return out.data;
}

const AUDIENCE = `Users in Bangladesh preparing for ANY exam:
- School/college students (SSC, HSC, class exams)
- University students (public/private/National University, engineering, medical, etc.): semester midterm/final exams,
  where "subjects" are their courses (course code + title, e.g. "CSE 2101 — Data Structures") and topics are the course outline/lectures;
  also thesis, lab and skill goals (IELTS, GRE, programming) if they ask
- University admission tests (DU, BUET, medical, engineering, GST cluster, etc.)
- Job seekers: BCS (preliminary, written, viva), bank jobs, primary assistant teacher, NTRCA, and other government / private recruitment exams
- Working people preparing alongside a job — they usually have limited daily time (often 1–3 hours, more on weekends)
Use your knowledge of the relevant official syllabus and mark distribution (e.g. BCS preliminary subject-wise marks) to propose subjects/topics,
give higher priority to high-mark and weak areas, and ask the user to confirm because syllabi change. For job exams, topics can be
syllabus sections (e.g. "বাংলা ব্যাকরণ", "বাংলাদেশ বিষয়াবলি — মুক্তিযুদ্ধ", "গাণিতিক যুক্তি — শতকরা") rather than textbook chapters.`;

const CHAT_SYSTEM = (today: string) => `You are PLANORA's study-planning assistant.
${AUDIENCE}
Reply in the student's language (Bangla by default; English if they write English). Be warm, short and clear.
Your job: through conversation, collect what is needed for a 30-day study plan (+ revision days added automatically):
- which exam/goal (e.g. "৪৭তম বিসিএস প্রিলি", "HSC 2027", "ঢাবি ভর্তি", "ব্যাংক জব") and whether they study full-time or alongside a job
- subjects, and the chapters/topics of each subject
- difficulty of each topic for this student (easy/medium/hard)
- daily study time
- exam date (optional — never invent one)
Rules:
- Ask at most 2 focused questions per turn.
- If the user names a known exam (BCS, bank, NTRCA, primary, admission, SSC, HSC…), propose its standard subjects/sections and ask them to confirm or edit.
- estimatedMinutes = realistic time to learn the topic the first time (usually 30–300); harder topics take longer.
- If the user pastes a course's class/lecture list, keep EVERY item as a topic in the same order (do not merge or drop), and put the course name in "course".
- Recurring daily habits (newspaper reading, daily writing practice, "2–3 topics per day") go in dailyTargets, not as topics.
- ALWAYS return the full current draft containing everything known so far (empty strings / 0 / [] when unknown).
- ready = true only when there is at least one subject with topics AND daily study time is known.
- When ready, briefly summarise and tell them to press "প্ল্যান তৈরি করো" (Create plan).
- Stay on topic: only study planning.
Today is ${today}.`;

export type ChatMessage = { role: "user" | "assistant"; text: string };

export async function aiChatTurn(
  history: ChatMessage[]
): Promise<Result<{ reply: string; ready: boolean; missing: string[]; draft: AiDraft }>> {
  const userId = await requireUserId();
  const limit = await checkQuota(userId);
  if (limit) return { ok: false, error: limit };

  const trimmed = history.slice(-20).map((m) => ({ ...m, text: m.text.slice(0, 4000) }));
  if (!trimmed.length || trimmed[trimmed.length - 1].role !== "user") return { ok: false, error: "বার্তা লিখুন" };

  const contents: GeminiContent[] = trimmed.map((m) => ({
    role: m.role === "user" ? "user" : "model",
    parts: [{ text: m.text }],
  }));

  try {
    const raw = await callAi(userId, "planner_chat", {
      system: CHAT_SYSTEM(todayIso()),
      contents,
      responseSchema: chatResponseSchema,
    });
    const turn = chatTurnSchema.parse(raw);
    return { ok: true, ...turn };
  } catch (e) {
    if (!(e instanceof AiError)) console.error("AI action failed", e);
    return { ok: false, error: e instanceof AiError ? e.message : "কিছু একটা ভুল হয়েছে" };
  }
}

export async function createPlanFromDraft(draft: unknown, source: Source): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  const d = aiDraftSchema.safeParse(draft);
  if (!d.success) return { ok: false, error: "ড্রাফট সঠিক নয়" };
  const n = await normalise(userId, draftToPlan(d.data));
  if (!n.ok) return n;
  return { ok: true, id: await insertDraft(userId, source, n.data) };
}

const AUTO_SYSTEM = `You generate complete 30-day study plan drafts.
${AUDIENCE}
Break every subject into concrete chapters/topics/syllabus sections appropriate to the stated exam (typically 5–15 per subject).
Give each topic a difficulty (easy/medium/hard) and estimatedMinutes (realistic first-time learning time, 30–300).
Keep the total estimated minutes at or below the available study minutes given. Give important / weaker subjects higher priority (1–5).
Use the same language as the input for names (Bangla input → Bangla names; English subject names are fine if the student used them).
Never invent an exam date — use the provided one or an empty string.`;

export async function autoGeneratePlan(input: {
  goal: string;
  subjects: string;
  examDate: string;
  dailyStudyMinutes: number;
  notes: string;
}): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  if (!input.subjects.trim()) return { ok: false, error: "অন্তত একটি বিষয় লিখুন" };
  const minutes = Math.min(720, Math.max(30, Math.round(input.dailyStudyMinutes || 0)));
  const limit = await checkQuota(userId);
  if (limit) return { ok: false, error: limit };

  const prompt = `Goal / level: ${input.goal.slice(0, 300) || "(not given)"}
Subjects: ${input.subjects.slice(0, 1500)}
Exam date: ${input.examDate || "(none)"}
Daily study time: ${minutes} minutes, 30 learning days → about ${minutes * 30} minutes available in total.
Weak areas / extra notes: ${input.notes.slice(0, 1000) || "(none)"}
Today: ${todayIso()}`;

  try {
    const raw = await callAi(userId, "planner_auto", {
      system: AUTO_SYSTEM,
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      responseSchema: draftResponseSchema,
      temperature: 0.3,
    });
    const draft = aiDraftSchema.parse(raw);
    const plan = draftToPlan({ ...draft, dailyStudyMinutes: minutes, examDate: input.examDate || draft.examDate });
    if (!plan.subjects.length) return { ok: false, error: "AI প্ল্যান বানাতে পারেনি, বিষয়গুলো আরও পরিষ্কার করে লিখুন" };
    const n = await normalise(userId, plan);
    if (!n.ok) return n;
    return { ok: true, id: await insertDraft(userId, "automatic", n.data) };
  } catch (e) {
    if (!(e instanceof AiError)) console.error("AI action failed", e);
    return { ok: false, error: e instanceof AiError ? e.message : "কিছু একটা ভুল হয়েছে" };
  }
}
