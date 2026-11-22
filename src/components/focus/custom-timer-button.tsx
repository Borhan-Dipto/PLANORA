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
 */
export function CustomTimerButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`${ui.card} flex w-full items-center justify-between hover:border-accent`}
      >
        <span className="flex items-center gap-2 text-sm font-medium">⏱️ টাইমার — যেকোনো সেশন শুরু করুন</span>
        <span className="text-accent">→</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4">
          <div className={`${ui.card} w-full max-w-sm`}>
            <h2 className="font-semibold">⏱️ কাস্টম টাইমার</h2>
            <p className="mt-1 text-xs text-muted">যেকোনো সেশনের নাম আর সময় দিন — টাইমার শুরু হয়ে নির্ধারিত সময়ে নিজেই শেষ হয়ে যাবে।</p>

            <label className={`${ui.label} mt-3`}>কী করবেন?</label>
            <input
              autoFocus
              className={ui.input}
              value={title}
              maxLength={120}
              placeholder="যেমন: বাংলাদেশ ও বিশ্ব পরিচয় বই পড়া"
              onChange={(e) => setTitle(e.target.value)}
            />

            <label className={`${ui.label} mt-3`}>কতক্ষণ?</label>
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

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={`${ui.btn} ${ui.secondary} flex-1`}
                disabled={pending}
              >
                বাতিল
              </button>
              <button type="button" onClick={submit} className={`${ui.btn} ${ui.primary} flex-1`} disabled={pending}>
                {pending ? "শুরু হচ্ছে…" : "▶ শুরু করুন"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
