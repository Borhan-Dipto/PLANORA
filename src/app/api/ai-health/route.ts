// TEMPORARY diagnostics — remove after the Gemini issue is resolved. Never returns the key.
export const maxDuration = 60;

async function probe(name: string, url: string, init: RequestInit) {
  const t = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(25_000) });
    const body = await r.text();
    return { name, status: r.status, ms: Date.now() - t, body: body.slice(0, 300) };
  } catch (e) {
    return { name, error: String(e), ms: Date.now() - t };
  }
}

export async function GET() {
  const key = process.env.AI_PROVIDER_API_KEY ?? "";
  const model = process.env.AI_PROVIDER_MODEL ?? "";
  const base = "https://generativelanguage.googleapis.com/v1beta";
  const gen = (m: string, headers: Record<string, string>) =>
    probe(`gen:${m}:${Object.keys(headers)[0]}`, `${base}/models/${m}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Say OK" }] }] }),
    });
  const results = await Promise.all([
    probe("list", `${base}/models?pageSize=50`, { headers: { "x-goog-api-key": key } }),
    gen(model, { "x-goog-api-key": key }),
    gen("gemini-2.5-flash", { "x-goog-api-key": key }),
    gen(model, { Authorization: `Bearer ${key}` }),
    probe("google.com", "https://www.google.com/generate_204", {}),
  ]);
  return Response.json({ model, keyPrefix: key.slice(0, 3), keyLen: key.length, results });
}
