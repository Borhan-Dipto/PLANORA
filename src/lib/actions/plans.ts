"use server";

import { and, eq, gte, count, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { plans, aiUsageLogs } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { analyzePlan, planDataSchema, FREE_REVISION_DAYS, todayIso, type PlanData } from "@/lib/plan/schema";
import { aiDraftSchema, chatTurnSchema, draftToPlan, type AiDraft } from "@/lib/plan/draft";
import { AiError, chatResponseSchema, draftResponseSchema, generateJson, type GeminiContent } from "@/lib/ai/gemini";
import { getUserTier } from "@/lib/plan/tier";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
type Source = "manual" | "ai_chat" | "automatic";

const DAILY_AI_LIMIT = 30;

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

/** Create (planId = null) or update a draft plan. */
export async function savePlan(planId: string | null, source: Source, input: unknown): Promise<Result<{ id: string }>> {
  const userId = await requireUserId();
  const n = await normalise(userId, input);
  if (!n.ok) return n;

  if (!planId) return { ok: true, id: await insertDraft(userId, source, n.data) };

  const updated = await db
    .update(plans)
    .set({ title: n.data.title, planData: n.data, startDate: n.data.startDate, updatedAt: new Date() })
    .where(and(eq(plans.id, planId), eq(plans.userId, userId), eq(plans.status, "draft")))
    .returning({ id: plans.id });
  if (!updated.length) return { ok: false, error: "শুধু ড্রাফট প্ল্যান এডিট করা যায়" };
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

  await db
    .update(plans)
    .set({ status: "active", approvedAt: new Date(), updatedAt: new Date() })
    .where(eq(plans.id, planId));
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

export async function deletePlan(planId: string): Promise<Result> {
  const userId = await requireUserId();
  await db.delete(plans).where(and(eq(plans.id, planId), eq(plans.userId, userId), eq(plans.status, "draft")));
  revalidatePath("/planner");
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
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [r] = await db
    .select({ c: count() })
    .from(aiUsageLogs)
    .where(and(eq(aiUsageLogs.userId, userId), gte(aiUsageLogs.createdAt, since)));
  return r.c >= DAILY_AI_LIMIT ? `আজকের AI লিমিট (${DAILY_AI_LIMIT}) শেষ। কাল আবার চেষ্টা করুন।` : null;
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

const CHAT_SYSTEM = (today: string) => `You are PLANORA's study-planning assistant for students in Bangladesh.
Reply in the student's language (Bangla by default; English if they write English). Be warm, short and clear.
Your job: through conversation, collect what is needed for a 30-day study plan (+ revision days added automatically):
- plan title / goal (e.g. "HSC 2027 প্রস্তুতি")
- subjects, and the chapters/topics of each subject
- difficulty of each topic for this student (easy/medium/hard)
- daily study time
- exam date (optional — never invent one)
Rules:
- Ask at most 2 focused questions per turn.
- If the student names a standard curriculum (SSC, HSC, admission, etc.), you may propose the usual chapters and ask them to confirm or edit.
- estimatedMinutes = realistic time to learn the topic the first time (usually 30–300); harder topics take longer.
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

const AUTO_SYSTEM = `You generate complete 30-day study plan drafts for students in Bangladesh.
Break every subject into concrete chapters/topics appropriate to the stated level/curriculum (typically 5–15 per subject).
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
    return { ok: false, error: e instanceof AiError ? e.message : "কিছু একটা ভুল হয়েছে" };
  }
}
