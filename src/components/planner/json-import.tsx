"use client";

import { useRef, useState } from "react";
import { MASTER_PROMPT, parsePlanJson } from "@/lib/plan/import";
import type { PlanData } from "@/lib/plan/schema";
import { ui } from "@/components/ui";

export function JsonImport({ onImport }: { onImport: (plan: PlanData) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<null | "prompt">(null);
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = (raw: string) => {
    const res = parsePlanJson(raw);
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    onImport(res.plan);
    setMsg({ ok: true, text: `✓ ${res.subjects}টি বিষয় ও ${res.topics}টি টপিক ইমপোর্ট হয়েছে — নিচে দেখে নিয়ে সেভ করুন` });
    setOpen(null);
    setText("");
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 1_000_000) return setMsg({ ok: false, text: "ফাইলটি অনেক বড় (সর্বোচ্চ ১ MB)" });
    load(await file.text());
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(MASTER_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setOpen("prompt");
    }
  };

  return (
    <section className={`${ui.card} border-dashed`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-56">
          <h2 className="font-semibold">JSON থেকে ইমপোর্ট</h2>
          <p className="mt-0.5 text-xs text-muted">
            মাস্টার প্রম্পট কপি করে ChatGPT / Claude / Gemini-কে দিন → যে JSON দেবে সেটা এখানে ফাইল আপলোড করুন বা নিচে কোড পেস্ট করুন।
          </p>
        </div>
        <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          <button type="button" onClick={copy} className={`${ui.btn} ${ui.secondary}`}>
            {copied ? "✓ কপি হয়েছে" : "📋 মাস্টার প্রম্পট"}
          </button>
          <button type="button" onClick={() => fileRef.current?.click()} className={`${ui.btn} ${ui.secondary}`}>
            📁 ফাইল আপলোড
          </button>
        </div>
        <input ref={fileRef} type="file" accept=".json,application/json,.txt" className="hidden" onChange={onFile} />
      </div>

      <button type="button" onClick={() => setOpen(open === "prompt" ? null : "prompt")} className="mt-2 text-xs text-accent">
        {open === "prompt" ? "প্রম্পট লুকান" : "প্রম্পটটি দেখুন"}
      </button>

      {open === "prompt" && (
        <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg bg-background p-3 text-xs">
          {MASTER_PROMPT}
        </pre>
      )}

      <div className="mt-3">
          <label className={ui.label}>অথবা JSON কোড এখানে পেস্ট করুন</label>
          <textarea
            className={`${ui.input} min-h-32 font-mono text-xs`}
            value={text}
            placeholder='{ "title": "...", "subjects": [ ... ] }'
            onChange={(e) => setText(e.target.value)}
          />
          <button type="button" disabled={!text.trim()} onClick={() => load(text)} className={`${ui.btn} ${ui.primary} mt-2 w-full sm:w-auto`}>
            ইমপোর্ট করুন
          </button>
        </div>

      {msg && <p className={`mt-3 text-sm ${msg.ok ? "text-success" : "text-error"}`}>{msg.text}</p>}
    </section>
  );
}
