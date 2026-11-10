import "server-only";

type Part = { text: string };
export type GeminiContent = { role: "user" | "model"; parts: Part[] };

export class AiError extends Error {}

const DEFAULT_MODELS = "gemini-flash-lite-latest,gemini-3.5-flash-lite,gemini-flash-latest";

/** Calls Gemini with structured JSON output. Returns parsed JSON + token usage. */
export async function generateJson({
  system,
  contents,
  responseSchema,
  temperature = 0.4,
}: {
  system: string;
  contents: GeminiContent[];
  responseSchema: object;
  temperature?: number;
}): Promise<{ data: unknown; inputTokens: number; outputTokens: number }> {
  const key = process.env.AI_PROVIDER_API_KEY;
  if (!key) throw new AiError("AI কনফিগার করা নেই");
  // Comma-separated fallback chain: if a model is overloaded (503), rate-limited (429) or retired (404), try the next.
  const models = (process.env.AI_PROVIDER_MODEL || DEFAULT_MODELS).split(",").map((m) => m.trim()).filter(Boolean);
  if (!models.includes("gemini-flash-lite-latest")) models.push("gemini-flash-lite-latest");

  const call = (model: string, thinking: boolean) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents,
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
          responseSchema,
          // Structured planning output doesn't need long "thinking".
          ...(thinking ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
        },
      }),
      signal: AbortSignal.timeout(35_000),
    });

  const started = Date.now();
  let res: Response | null = null;
  let lastStatus = 0;
  for (const model of models) {
    if (Date.now() - started > 80_000) break;
    try {
      let r = await call(model, false);
      if (r.status === 400 && /thinking/i.test(await r.clone().text())) r = await call(model, true);
      if (r.ok) {
        res = r;
        break;
      }
      lastStatus = r.status;
      console.error("Gemini error", model, r.status, (await r.text()).slice(0, 300));
      if (![404, 429, 500, 503].includes(r.status)) break; // auth/request errors won't be fixed by another model
    } catch (e) {
      console.error("Gemini fetch failed", model, Date.now() - started, "ms", e);
      lastStatus = 504;
    }
  }

  if (!res) {
    if (lastStatus === 429) throw new AiError("AI এখন ব্যস্ত, এক মিনিট পরে আবার চেষ্টা করুন");
    if (lastStatus === 503 || lastStatus === 504) throw new AiError("AI সার্ভারে এখন অনেক চাপ, একটু পরে আবার চেষ্টা করুন");
    throw new AiError("AI সার্ভিসে সমস্যা হয়েছে, আবার চেষ্টা করুন");
  }

  const json = await res.json();
  console.info("Gemini ok", json?.modelVersion, Date.now() - started, "ms");
  const text: string | undefined = json?.candidates?.[0]?.content?.parts
    ?.map((p: Part) => p.text ?? "")
    .join("");
  if (!text) throw new AiError("AI কোনো উত্তর দেয়নি, আবার চেষ্টা করুন");

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new AiError("AI-এর উত্তর বোঝা যায়নি, আবার চেষ্টা করুন");
  }
  return {
    data,
    inputTokens: json?.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: json?.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

/* ---------- Response schemas (Gemini OpenAPI subset) ---------- */

export const draftResponseSchema = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    goal: { type: "STRING" },
    examDate: { type: "STRING", description: "YYYY-MM-DD, or empty string if unknown" },
    dailyStudyMinutes: { type: "INTEGER", description: "0 if unknown" },
    dailyTargets: {
      type: "ARRAY",
      items: { type: "STRING" },
      description: "Recurring daily habits, e.g. 'প্রতিদিন English Newspaper পড়া', 'প্রতিদিন ২–৩টি টপিক'",
    },
    subjects: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          course: { type: "STRING", description: "Course/batch name if any, else empty" },
          priority: { type: "INTEGER", description: "1 (low) to 5 (high)" },
          topics: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                name: { type: "STRING" },
                difficulty: { type: "STRING", enum: ["easy", "medium", "hard"] },
                estimatedMinutes: { type: "INTEGER" },
              },
              required: ["name", "difficulty", "estimatedMinutes"],
            },
          },
        },
        required: ["name", "course", "priority", "topics"],
      },
    },
  },
  required: ["title", "goal", "examDate", "dailyStudyMinutes", "dailyTargets", "subjects"],
};

export const chatResponseSchema = {
  type: "OBJECT",
  properties: {
    reply: { type: "STRING", description: "Message shown to the student" },
    ready: { type: "BOOLEAN", description: "true when the draft is complete enough to create a plan" },
    missing: { type: "ARRAY", items: { type: "STRING" }, description: "Short labels of still-missing info" },
    draft: draftResponseSchema,
  },
  required: ["reply", "ready", "missing", "draft"],
};
