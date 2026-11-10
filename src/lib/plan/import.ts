import { z } from "zod";
import { aiDraftSchema, draftToPlan } from "./draft";
import type { PlanData } from "./schema";

/** Prompt users paste into ChatGPT / Claude / Gemini to get a PLANORA-compatible JSON file. */
export const MASTER_PROMPT = `তুমি একজন অভিজ্ঞ স্টাডি প্ল্যানার। আমি PLANORA অ্যাপে একটি ৩০ দিনের স্টাডি প্ল্যান ইমপোর্ট করব। নিচের তথ্য অনুযায়ী শুধুমাত্র একটি JSON দাও — কোনো ব্যাখ্যা, কোনো অতিরিক্ত লেখা নয়।

আমার তথ্য:
- পরীক্ষা / লক্ষ্য: [যেমন: ৪৭তম বিসিএস প্রিলিমিনারি / HSC 2027 / CSE 3rd semester final]
- যে বিষয়গুলো পড়তে চাই: [বিষয়গুলো লিখুন, অথবা "পুরো সিলেবাস অনুযায়ী"]
- দৈনিক পড়ার সময়: [যেমন: ৩ ঘণ্টা]
- পরীক্ষার তারিখ (যদি থাকে): [YYYY-MM-DD]
- দুর্বল দিক / অতিরিক্ত নোট: [যেমন: ইংরেজি গ্রামারে দুর্বল, চাকরির পাশাপাশি পড়ি]

নিয়ম:
1. প্রতিটি বিষয়কে ছোট ছোট টপিক/অধ্যায়/সিলেবাস-অংশে ভাগ করো (সাধারণত প্রতি বিষয়ে ৫–১৫টি)।
2. "difficulty" হবে শুধু "easy", "medium" অথবা "hard"।
3. "estimatedMinutes" = টপিকটি প্রথমবার ভালোভাবে শিখতে বাস্তবসম্মত সময় (মিনিটে, ১০ থেকে ১২০০-এর মধ্যে পূর্ণসংখ্যা)।
4. "priority" = ১ (কম) থেকে ৫ (সবচেয়ে বেশি) — বেশি নম্বরের ও দুর্বল বিষয়ে বেশি দাও।
5. সব টপিকের মোট সময় যেন (দৈনিক মিনিট × ৩০)-এর বেশি না হয়।
6. "dailyStudyMinutes" মিনিটে দাও (৩০–৭২০)। "examDate" না জানলে "" দাও।
7. "studyWeekdays": কোন দিন পড়ব — 0=রবি, 1=সোম, 2=মঙ্গল, 3=বুধ, 4=বৃহস্পতি, 5=শুক্র, 6=শনি।
8. আউটপুট অবশ্যই valid JSON হবে, ঠিক নিচের কাঠামোয়:

{
  "title": "৪৭তম বিসিএস প্রিলি প্রস্তুতি",
  "goal": "৩০ দিনে পুরো সিলেবাস একবার শেষ করা",
  "examDate": "",
  "dailyStudyMinutes": 180,
  "studyWeekdays": [0, 1, 2, 3, 4, 5, 6],
  "subjects": [
    {
      "name": "বাংলা ভাষা ও সাহিত্য",
      "priority": 5,
      "topics": [
        { "name": "বাংলা ব্যাকরণ — সন্ধি ও সমাস", "difficulty": "medium", "estimatedMinutes": 90 },
        { "name": "প্রাচীন ও মধ্যযুগের সাহিত্য", "difficulty": "hard", "estimatedMinutes": 120 }
      ]
    }
  ]
}`;

const importSchema = aiDraftSchema.extend({
  studyWeekdays: z.array(z.number().int().min(0).max(6)).min(1).catch([0, 1, 2, 3, 4, 5, 6]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().catch(undefined),
});

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

  const parsed = importSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "JSON-এর কাঠামো মিলছে না — মাস্টার প্রম্পট ব্যবহার করুন" };

  const plan = draftToPlan(parsed.data);
  plan.studyWeekdays = [...new Set(parsed.data.studyWeekdays)].sort();
  if (parsed.data.startDate) plan.startDate = parsed.data.startDate;

  const topics = plan.subjects.reduce((n, s) => n + s.topics.length, 0);
  if (!plan.subjects.length || !topics) return { ok: false, error: "JSON-এ কোনো বিষয় বা টপিক নেই" };
  return { ok: true, plan, subjects: plan.subjects.length, topics };
}
