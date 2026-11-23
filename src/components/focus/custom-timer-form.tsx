"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startCustomFocusSession } from "@/lib/actions/focus";
import { ui } from "@/components/ui";

const PRESETS = [15, 30, 50, 60, 90];

/**
 * "কাস্টম টাইমার" — any user, any time: type whatever you're about to do (a book, a random chore,
 * anything outside the usual plan) and however many minutes you want, and start the exact same
 * focus-mode timer the plan tasks use. No plan/task involved — see startCustomFocusSession.
 * Reached from the main nav (⏱️ টাইমার); if a session is already running, the page above this
 * form (/focus/custom) redirects straight to /focus instead of rendering this.
 */
export function CustomTimerForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [minutesText, setMinutesText] = useState("50");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = () => {
    setError("");
    const minutes = Number(minutesText);
    start(async () => {
      const res = await startCustomFocusSession(title, minutes);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/focus");
    });
  };

  return (
    <section className={ui.card}>
      <h1 className="font-semibold">⏱️ কাস্টম টাইমার</h1>
      <p className="mt-1 text-sm text-muted">
        যেকোনো সেশনের নাম আর সময় দিন — টাইমার শুরু হয়ে নির্ধারিত সময়ে নিজেই শেষ হয়ে যাবে।
      </p>

      <label className={`${ui.label} mt-4`}>কী করবেন?</label>
      <input
        autoFocus
        className={ui.input}
        value={title}
        maxLength={120}
        placeholder="যেমন: বাংলাদেশ ও বিশ্ব পরিচয় বই পড়া"
        onChange={(e) => setTitle(e.target.value)}
      />

      <label className={`${ui.label} mt-4`}>কতক্ষণ?</label>
      <div className="flex flex-wrap gap-1.5">
        {PRESETS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMinutesText(String(m))}
            className={`rounded-full border px-3 py-1 text-xs ${
              minutesText === String(m) ? "border-accent bg-accent/10 text-accent" : "border-border text-muted"
            }`}
          >
            {m} মি.
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1.5">
        <input
          type="number"
          inputMode="numeric"
          min={5}
          max={600}
          step={5}
          className={`${ui.input} w-24`}
          value={minutesText}
          onChange={(e) => setMinutesText(e.target.value)}
        />
        <span className="text-xs text-muted">মিনিট (৫–৬০০)</span>
      </div>

      {error && <p className="mt-2 text-sm text-error">{error}</p>}

      <button type="button" onClick={submit} className={`${ui.btn} ${ui.primary} mt-4 w-full`} disabled={pending}>
        {pending ? "শুরু হচ্ছে…" : "▶ শুরু করুন"}
      </button>
    </section>
  );
}
