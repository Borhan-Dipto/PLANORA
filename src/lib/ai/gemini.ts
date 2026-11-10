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

  // Request variants, tried in order on HTTP 400 — models differ in which structured-output options they accept.
  type Variant = "schema" | "jsonSchema" | "plain";
  const variants: { v: Variant; thinkingOff: boolean }[] = [
    { v: "schema", thinkingOff: false }, // thinkingBudget:0 is rejected by current Gemini models (400)
    { v: "jsonSchema", thinkingOff: false },
    { v: "plain", thinkingOff: false },
  ];

  const call = (model: string, { v, thinkingOff }: { v: Variant; thinkingOff: boolean }) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: {
          parts: [
            {
              text:
                v === "plain"
                  ? `${system}\n\nRespond ONLY with a JSON object matching this schema:\n${JSON.stringify(toJsonSchema(responseSchema))}`
                  : system,
            },
          ],
        },
        contents,
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
          ...(v === "schema" ? { responseSchema } : {}),
          ...(v === "jsonSchema" ? { responseJsonSchema: toJsonSchema(responseSchema) } : {}),
          ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      }),
      signal: AbortSignal.timeout(35_000),
    });

  const started = Date.now();
  let res: Response | null = null;
  let lastStatus = 0;
  outer: for (const model of models) {
    for (const variant of variants) {
      if (Date.now() - started > 80_000) break outer;
      try {
        const r = await call(model, variant);
        if (r.ok) {
          console.info("Gemini variant", model, variant.v, variant.thinkingOff ? "no-thinking" : "");
          res = r;
          break outer;
        }
        lastStatus = r.status;
        console.error("Gemini error", model, variant.v, r.status, (await r.text()).slice(0, 300));
        if (r.status === 400) continue; // try next request variant on the same model
        if ([404, 429, 500, 503].includes(r.status)) continue outer; // try next model
        break outer; // auth errors etc.
      } catch (e) {
        console.error("Gemini fetch failed", model, Date.now() - started, "ms", e);
        lastStatus = 504;
        continue outer;
      }
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

/** Gemini OpenAPI-subset schema (UPPERCASE types) → standard JSON Schema. */
function toJsonSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toJsonSchema);
  if (!node || typeof node !== "object") return node;
  return Object.fromEntries(
    Object.entries(node).map(([k, v]) => [k, k === "type" && typeof v === "string" ? v.toLowerCase() : toJsonSchema(v)])
  );
}
