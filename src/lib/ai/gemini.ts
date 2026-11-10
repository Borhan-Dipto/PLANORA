import "server-only";

type Part = { text: string };
export type GeminiContent = { role: "user" | "model"; parts: Part[] };

export class AiError extends Error {}

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
  const model = process.env.AI_PROVIDER_MODEL || "gemini-flash-latest";
  if (!key) throw new AiError("AI কনফিগার করা নেই");

  const call = (thinking: boolean) =>
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
          // Structured planning output doesn't need long "thinking" — it made calls time out.
          ...(thinking ? {} : { thinkingConfig: { thinkingBudget: 0 } }),
        },
      }),
      signal: AbortSignal.timeout(100_000),
    });

  const started = Date.now();
  let res: Response;
  try {
    res = await call(false);
    if (res.status === 400) {
      const body = await res.clone().text();
      if (/thinking/i.test(body)) res = await call(true); // model doesn't accept a zero budget
    }
  } catch (e) {
    console.error("Gemini fetch failed", model, Date.now() - started, "ms", e);
    if (e instanceof Error && e.name === "TimeoutError") throw new AiError("AI উত্তর দিতে বেশি সময় নিচ্ছে, আবার চেষ্টা করুন");
    throw new AiError("AI-এর সাথে যোগাযোগ করা যায়নি, আবার চেষ্টা করুন");
  }

  if (!res.ok) {
    const body = await res.text();
    console.error("Gemini error", res.status, body.slice(0, 500));
    if (res.status === 429) throw new AiError("AI এখন ব্যস্ত, এক মিনিট পরে আবার চেষ্টা করুন");
    throw new AiError("AI সার্ভিসে সমস্যা হয়েছে, আবার চেষ্টা করুন");
  }

  const json = await res.json();
  console.info("Gemini ok", json?.modelVersion ?? model, Date.now() - started, "ms");
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
    subjects: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
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
        required: ["name", "priority", "topics"],
      },
    },
  },
  required: ["title", "goal", "examDate", "dailyStudyMinutes", "subjects"],
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
