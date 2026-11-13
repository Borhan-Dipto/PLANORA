"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { aiChatTurn, createPlanFromDraft, type ChatMessage } from "@/lib/actions/plans";
import type { AiDraft } from "@/lib/plan/draft";
import { ui } from "@/components/ui";
import { draftToPlan } from "@/lib/plan/draft";
import { downloadJson } from "@/lib/plan/import";

const greeting = (days: number) =>
  `আসসালামু আলাইকুম! 👋 আমি আপনার ${days} দিনের স্টাডি প্ল্যান বানাতে সাহায্য করব। শুরুতে বলুন — কোন পরীক্ষার প্রস্তুতি নিচ্ছেন? (যেমন: বিসিএস, ব্যাংক জব, ভর্তি পরীক্ষা, বিশ্ববিদ্যালয়ের সেমিস্টার, HSC…) আর আপনি কি ফুল-টাইম পড়ছেন নাকি চাকরির পাশাপাশি?`;

export function AiChat({ learningDays }: { learningDays?: number }) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [thinking, startThinking] = useTransition();
  const [creating, startCreating] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [messages, thinking]);

  const send = (e?: React.FormEvent) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || thinking) return;
    const history: ChatMessage[] = [...messages, { role: "user", text }];
    setMessages(history);
    setInput("");
    setError("");
    startThinking(async () => {
      const res = await aiChatTurn(history, learningDays);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessages((m) => [...m, { role: "assistant", text: res.reply }]);
      setDraft(res.draft);
      setReady(res.ready);
      setMissing(res.missing);
    });
  };

  const create = () =>
    startCreating(async () => {
      if (!draft) return;
      const res = await createPlanFromDraft(draft, "ai_chat", learningDays);
      if (!res.ok) return setError(res.error);
      router.push(`/planner/${res.id}`);
    });

  const topicCount = draft?.subjects.reduce((n, s) => n + s.topics.length, 0) ?? 0;

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] flex-col md:h-[calc(100dvh-6.5rem)]">
      <div className="flex-1 space-y-3 overflow-y-auto pb-4">
        <Bubble role="assistant" text={greeting(learningDays ?? 30)} />
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.text} />
        ))}
        {thinking && <Bubble role="assistant" text="ভাবছি…" muted />}
        <div ref={endRef} />
      </div>

      {draft && (draft.subjects.length > 0 || ready) && (
        <div className={`${ui.card} mb-3 p-3`}>
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 flex-1 text-sm">
              <span className="font-medium">{draft.title || "ড্রাফট প্ল্যান"}</span>
              <span className="text-muted">
                {" "}
                · {draft.subjects.length} বিষয় · {topicCount} টপিক
              </span>
            </p>
            <button
              type="button"
              onClick={() => downloadJson(draftToPlan(draft))}
              disabled={!draft.subjects.length}
              className={`${ui.btn} ${ui.ghost} w-full sm:w-auto`}
            >
              ⬇ JSON
            </button>
            <button
              onClick={create}
              disabled={creating || !draft.subjects.length}
              className={`${ui.btn} ${ready ? ui.primary : ui.secondary} w-full sm:w-auto`}
            >
              {creating ? "তৈরি হচ্ছে…" : "প্ল্যান তৈরি করো"}
            </button>
          </div>
          {!ready && missing.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {missing.slice(0, 6).map((m) => (
                <span key={m} className="rounded-full bg-warning/15 px-2 py-0.5 text-xs text-warning">
                  {m}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {error && <p className="mb-2 text-sm text-error">{error}</p>}

      <form onSubmit={send} className="flex items-end gap-2">
        <textarea
          rows={1}
          value={input}
          maxLength={4000}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) send(e);
          }}
          placeholder="আপনার উত্তর লিখুন…"
          className={`${ui.input} max-h-40 min-h-11 flex-1 resize-none py-2.5`}
        />
        <button disabled={thinking || !input.trim()} className={`${ui.btn} ${ui.primary} h-11`} aria-label="পাঠান">
          ➤
        </button>
      </form>
    </div>
  );
}

function Bubble({ role, text, muted }: { role: "user" | "assistant"; text: string; muted?: boolean }) {
  const mine = role === "user";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm sm:max-w-[75%] ${
          mine ? "rounded-br-sm bg-accent text-accent-foreground" : "rounded-bl-sm border border-border bg-surface"
        } ${muted ? "animate-pulse text-muted" : ""}`}
      >
        {text}
      </div>
    </div>
  );
}
