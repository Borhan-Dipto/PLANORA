"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { completeFocusSession, emergencyExitFocusSession, pingFocusSession, type ActiveSession } from "@/lib/actions/focus";

const RING_R = 120;
const RING_C = 2 * Math.PI * RING_R;
const EXIT_REASONS = ["জরুরি প্রয়োজন", "ব্যাটারি/নেটওয়ার্ক সমস্যা", "শরীর খারাপ লাগছে", "অন্য কারণ"];

function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function FocusScreen({ session }: { session: ActiveSession }) {
  const router = useRouter();
  const startedAt = useRef(new Date(session.startedAtIso).getTime()).current;
  const [elapsedSec, setElapsedSec] = useState(() => Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
  const [distractions, setDistractions] = useState(session.distractionCount);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitReason, setExitReason] = useState("");
  const [exitCustom, setExitCustom] = useState("");
  const [done, setDone] = useState<{ actualMinutes: number; targetMinutes: number } | null>(null);
  const [, start] = useTransition();
  const wasHidden = useRef(false);

  // The ticking display is purely cosmetic — re-syncs to the server's startedAt every render,
  // so a wrong device clock can't be used to fast-forward or rewind the timer.
  useEffect(() => {
    const id = setInterval(() => setElapsedSec(Math.max(0, Math.round((Date.now() - startedAt) / 1000))), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  // Heartbeat so the server knows the session is still alive, and to log when the student looks away.
  useEffect(() => {
    const id = setInterval(() => {
      const wasAway = wasHidden.current;
      wasHidden.current = false;
      if (wasAway) setDistractions((d) => d + 1);
      start(async () => {
        await pingFocusSession(session.id, wasAway);
      });
    }, 20_000);
    return () => clearInterval(id);
  }, [session.id]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) wasHidden.current = true;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Block the back gesture / button — the only ways out are the two explicit buttons below.
  useEffect(() => {
    if (done) return;
    history.pushState(null, "", location.href);
    const onPop = () => {
      history.pushState(null, "", location.href);
      setExitOpen(true);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [done]);

  // Warn on refresh/close — can't customize the text, but it stops an accidental tap from losing the session.
  useEffect(() => {
    if (done) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [done]);

  useEffect(() => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const finish = useCallback(() => {
    start(async () => {
      const res = await completeFocusSession(session.id);
      if (res.ok) setDone({ actualMinutes: res.actualMinutes, targetMinutes: res.targetMinutes });
    });
  }, [session.id]);

  const confirmExit = useCallback(() => {
    const reason = exitReason === "অন্য কারণ" ? exitCustom.trim() || "অন্য কারণ" : exitReason;
    start(async () => {
      await emergencyExitFocusSession(session.id, reason);
      router.push("/dashboard");
    });
  }, [exitReason, exitCustom, session.id, router]);

  if (done) {
    const over = done.actualMinutes >= done.targetMinutes;
    return (
      <FocusShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-5xl">{over ? "🎉" : "✅"}</span>
          <h1 className="text-2xl font-bold text-white">সম্পন্ন!</h1>
          <p className="text-slate-300">
            আপনি <b className="text-white">{done.actualMinutes} মিনিট</b> ফোকাস করেছেন (লক্ষ্য ছিল {done.targetMinutes} মিনিট)।
          </p>
          <button
            onClick={() => router.push("/dashboard")}
            className="mt-4 rounded-full bg-white px-6 py-2.5 font-medium text-slate-900"
          >
            ড্যাশবোর্ডে ফিরুন
          </button>
        </div>
      </FocusShell>
    );
  }

  const targetSec = session.targetMinutes * 60;
  const progress = targetSec > 0 ? elapsedSec / targetSec : 0;
  const overTime = progress >= 1;
  const tone = overTime ? "error" : progress >= 0.75 ? "warning" : "success";
  const strokeClass = { success: "stroke-accent", warning: "stroke-warning", error: "stroke-error" }[tone];
  const textClass = { success: "text-white", warning: "text-warning", error: "text-error" }[tone];
  const dashOffset = RING_C * (1 - Math.min(1, progress));

  return (
    <FocusShell>
      <div className="flex w-full max-w-sm flex-col items-center gap-1 text-center">
        {session.subjectName && <p className="text-sm font-medium text-slate-400">{session.subjectName}</p>}
        <h1 className="mb-6 line-clamp-2 px-4 text-lg font-semibold text-white">{session.title}</h1>

        <div className="relative flex h-64 w-64 items-center justify-center">
          <svg viewBox="0 0 260 260" className="h-64 w-64 -rotate-90">
            <circle cx="130" cy="130" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
            <circle
              cx="130"
              cy="130"
              r={RING_R}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              className={`${strokeClass} transition-[stroke-dashoffset] duration-1000 ease-linear ${overTime ? "animate-pulse" : ""}`}
              strokeDasharray={RING_C}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className={`font-mono text-4xl font-bold tabular-nums ${textClass}`}>{fmtClock(elapsedSec)}</span>
            <span className="mt-1 text-xs text-slate-500">লক্ষ্য {session.targetMinutes} মিনিট</span>
            {overTime && <span className="mt-1 text-xs text-error">+{fmtClock(elapsedSec - targetSec)} অতিরিক্ত</span>}
          </div>
        </div>

        {distractions > 0 && (
          <p className="mt-6 text-xs text-slate-500">আপনি {distractions} বার ফোকাস থেকে সরে গিয়েছিলেন — সময় তবু চলছিলই।</p>
        )}

        <p className="mt-8 max-w-xs text-sm text-slate-500">এখানে পজ করার কোনো অপশন নেই। সময় গণনা চলতেই থাকবে, যতক্ষণ না আপনি শেষ করেন।</p>

        <div className="mt-8 flex w-full flex-col gap-3">
          <button onClick={finish} className="rounded-full bg-success px-6 py-3.5 font-semibold text-white">
            ✓ পড়া শেষ করেছি
          </button>
          <button onClick={() => setExitOpen(true)} className="rounded-full border border-slate-700 px-6 py-3 text-sm text-slate-400">
            🚨 জরুরি অবস্থায় বের হোন
          </button>
        </div>
      </div>

      {exitOpen && (
        <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 p-5">
            <h2 className="font-semibold text-white">জরুরি অবস্থায় বের হচ্ছেন?</h2>
            <p className="mt-1 text-sm text-slate-400">এই টপিকটি অসম্পূর্ণ থাকবে এবং পরে আবার শুরু করতে হবে। কারণ বেছে নিন:</p>
            <div className="mt-3 flex flex-col gap-2">
              {EXIT_REASONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setExitReason(r)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    exitReason === r ? "border-accent bg-accent/10 text-white" : "border-slate-700 text-slate-300"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
            {exitReason === "অন্য কারণ" && (
              <input
                autoFocus
                value={exitCustom}
                onChange={(e) => setExitCustom(e.target.value)}
                placeholder="কারণ লিখুন"
                className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white outline-none"
              />
            )}
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setExitOpen(false)}
                className="flex-1 rounded-lg border border-slate-700 py-2 text-sm text-slate-300"
              >
                ফিরে যাই, পড়া চালিয়ে যাই
              </button>
              <button
                disabled={!exitReason}
                onClick={confirmExit}
                className="flex-1 rounded-lg bg-error py-2 text-sm font-medium text-white disabled:opacity-40"
              >
                নিশ্চিত, বের হচ্ছি
              </button>
            </div>
          </div>
        </div>
      )}
    </FocusShell>
  );
}

function FocusShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0E14] p-6" style={{ colorScheme: "dark" }}>
      {children}
    </div>
  );
}
