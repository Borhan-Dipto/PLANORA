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
  const list = await fetch(`${base}/models?pageSize=200`, { headers: { "x-goog-api-key": key } }).then((r) => r.json()).catch(() => ({}));
  const names = (list.models ?? [])
    .filter((m: { supportedGenerationMethods?: string[] }) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m: { name: string }) => m.name.replace("models/", ""));
  const results = await Promise.all([
    gen("gemini-3.8-flash", { "x-goog-api-key": key }),
    gen("gemini-flash-lite-latest", { "x-goog-api-key": key }),
    gen(model, { "x-goog-api-key": key }),
  ]);
  return Response.json({ model, names, results });
}
