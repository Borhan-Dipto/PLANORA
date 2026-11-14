"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adjustFocusTarget, completeFocusSession, emergencyExitFocusSession, pingFocusSession, type ActiveSession } from "@/lib/actions/focus";

const RING_R = 120;
const RING_C = 2 * Math.PI * RING_R;
const EXIT_REASONS = ["জরুরি প্রয়োজন", "ব্যাটারি/নেটওয়ার্ক সমস্যা", "শরীর খারাপ লাগছে", "অন্য কারণ"];

// Milestones are checked against progress (0→1). Each fires once, in order, with a short
// toast + haptic pulse — a small "variable reward" nudge (goal-gradient effect: people push
// harder as a visible goal gets closer) without ever breaking the countdown's focus.
const MILESTONES = [
  { at: 0.25, text: "ভালো শুরু — গতি ধরে রাখুন 🔥" },
  { at: 0.5, text: "অর্ধেক শেষ! এগিয়ে যান 💪" },
  { at: 0.75, text: "প্রায় শেষের পথে — থামবেন না 🚀" },
  { at: 0.9, text: "একদম কাছাকাছি! শেষ টুকু শেষ করুন 🏁" },
];
// Rotated below the ring so staring at a static screen doesn't itself become a distraction —
// brief, varied, non-intrusive cues keep attention anchored on the task (not on checking the phone).
const AFFIRMATIONS = [
  "এক নিঃশ্বাসে মনোযোগ ফিরিয়ে আনুন।",
  "শুধু এই মুহূর্তটুকু পড়ুন — বাকিটা পরে।",
  "ছোট ছোট অগ্রগতিই বড় ফলাফল গড়ে।",
  "আপনার লক্ষ্য আপনার থেকে বেশি দূরে নেই।",
  "মনোযোগ একটা পেশি — এখন সেটাই গড়ছেন।",
];

function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported — ignore */
  }
}

function fmtClock(totalSeconds: number) {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** super_admin-only for now (premium feature): the timer auto-completes the moment its target
 * elapses, and a +/- 5-minute adjuster sits under the ring. Everyone else keeps the existing
 * manual-finish behavior (countdown runs into "overtime" until they tap "পড়া শেষ করেছি"). */
export function FocusScreen({ session, superAdmin = false }: { session: ActiveSession; superAdmin?: boolean }) {
  const router = useRouter();
  // Lazy initializer runs once and the value is never reassigned — stable across re-renders
  // without touching a ref during render (which React now flags).
  const [startedAt] = useState(() => new Date(session.startedAtIso).getTime());
  const [elapsedSec, setElapsedSec] = useState(() => Math.max(0, Math.round((Date.now() - startedAt) / 1000)));
  const [targetMinutes, setTargetMinutes] = useState(session.targetMinutes);
  const [adjustPending, startAdjust] = useTransition();
  const [distractions, setDistractions] = useState(session.distractionCount);
  const [exitOpen, setExitOpen] = useState(false);
  const [exitReason, setExitReason] = useState("");
  const [exitCustom, setExitCustom] = useState("");
  const [done, setDone] = useState<{ actualMinutes: number; targetMinutes: number } | null>(null);
  const [, start] = useTransition();
  const wasHidden = useRef(false);
  const [toast, setToast] = useState<string | null>(null);
  const milestoneIdx = useRef(0);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [affirmIdx, setAffirmIdx] = useState(0);

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
    // The PWA manifest no longer locks orientation, but some browsers still carry a stale lock
    // from an earlier install — explicitly unlock so rotating the phone works in fullscreen too.
    try {
      (screen.orientation as ScreenOrientation & { unlock?: () => void })?.unlock?.();
    } catch {
      /* unsupported — ignore */
    }
    return () => {
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  // Rotate a short affirmation every 40s — enough variety to stay fresh, slow enough to never distract.
  useEffect(() => {
    const id = setInterval(() => setAffirmIdx((i) => (i + 1) % AFFIRMATIONS.length), 40_000);
    return () => clearInterval(id);
  }, []);

  const targetSecForMilestones = targetMinutes * 60;
  useEffect(() => {
    if (targetSecForMilestones <= 0) return;
    const p = elapsedSec / targetSecForMilestones;
    const next = MILESTONES[milestoneIdx.current];
    if (next && p >= next.at) {
      milestoneIdx.current += 1;
      vibrate(next.at >= 0.9 ? [40, 60, 40] : 30);
      setToast(next.text);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 3600);
    }
  }, [elapsedSec, targetSecForMilestones]);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const finish = useCallback(() => {
    start(async () => {
      const res = await completeFocusSession(session.id);
      if (res.ok) setDone({ actualMinutes: res.actualMinutes, targetMinutes: res.targetMinutes });
    });
  }, [session.id]);

  // super_admin-only auto-complete: the moment the target elapses, close the session the same
  // way the manual "পড়া শেষ করেছি" button does — no extra tap needed. autoFinished guards
  // against firing twice (e.g. a re-render landing exactly on the threshold again).
  const autoFinished = useRef(false);
  useEffect(() => {
    if (!superAdmin || done || autoFinished.current) return;
    if (targetSecForMilestones > 0 && elapsedSec >= targetSecForMilestones) {
      autoFinished.current = true;
      finish();
    }
  }, [superAdmin, done, elapsedSec, targetSecForMilestones, finish]);

  const adjustTime = useCallback(
    (delta: number) => {
      setTargetMinutes((t) => Math.max(5, Math.min(600, t + delta)));
      startAdjust(async () => {
        const res = await adjustFocusTarget(session.id, delta);
        if (res.ok) setTargetMinutes(res.targetMinutes);
      });
    },
    [session.id],
  );

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

  const targetSec = targetMinutes * 60;
  const progress = targetSec > 0 ? elapsedSec / targetSec : 0;
  const overTime = progress >= 1;
  const remainingSec = Math.max(0, targetSec - elapsedSec);
  const overSec = Math.max(0, elapsedSec - targetSec);
  const tone = overTime ? "error" : progress >= 0.75 ? "warning" : "success";
  const strokeClass = { success: "stroke-accent", warning: "stroke-warning", error: "stroke-error" }[tone];
  const textClass = { success: "text-white", warning: "text-warning", error: "text-error" }[tone];
  const glowClass = { success: "bg-accent/25", warning: "bg-warning/25", error: "bg-error/30" }[tone];
  const clippedProgress = Math.min(1, progress);
  const dashOffset = RING_C * (1 - clippedProgress);
  // Dot marks the live tip of the ring. The whole <svg> is rotated -90°, so a point placed at
  // angle 2π·progress (clockwise from 3 o'clock, SVG's default) lands exactly on the filled edge
  // after rotation — i.e. starting at 12 o'clock, same as the stroke itself.
  const dotAngle = 2 * Math.PI * clippedProgress;
  const dotX = 130 + RING_R * Math.cos(dotAngle);
  const dotY = 130 + RING_R * Math.sin(dotAngle);

  return (
    <FocusShell>
      <div className="flex w-full max-w-sm flex-col items-center gap-1 text-center landscape:grid landscape:max-w-5xl landscape:grid-cols-[1fr_auto_1fr] landscape:items-center landscape:gap-10 landscape:text-left">
        <div className="landscape:col-start-1 landscape:row-start-1 landscape:justify-self-end">
          {session.subjectName && <p className="text-sm font-medium text-slate-400">{session.subjectName}</p>}
          <h1 className="mb-6 line-clamp-2 px-4 text-lg font-semibold text-white landscape:px-0 landscape:mb-4">{session.title}</h1>

          <p className="min-h-[1.25rem] text-sm text-slate-400 transition-opacity duration-500 landscape:text-left">{AFFIRMATIONS[affirmIdx]}</p>

          {distractions > 0 && (
            <p className="mt-3 text-xs text-slate-500">আপনি {distractions} বার ফোকাস থেকে সরে গিয়েছিলেন — সময় তবু চলছিলই।</p>
          )}

          <p className="mt-6 max-w-xs text-xs text-slate-600 landscape:max-w-none">এখানে পজ করার কোনো অপশন নেই। সময় গণনা চলতেই থাকবে, যতক্ষণ না আপনি শেষ করেন।</p>

          <div className="mt-8 flex w-full flex-col gap-3 landscape:max-w-xs">
            <button
              onClick={finish}
              className="rounded-full border border-slate-700 bg-[#0A0E14] px-6 py-3.5 font-semibold text-white transition-transform active:scale-95"
            >
              ✓ পড়া শেষ করেছি
            </button>
            <button
              onClick={() => setExitOpen(true)}
              className="rounded-full border border-slate-700 px-6 py-3 text-sm text-slate-400 transition-transform active:scale-95"
            >
              🚨 জরুরি অবস্থায় বের হোন
            </button>
          </div>
        </div>

        {/* Ring + time — the main highlight, enlarged whenever the phone is in landscape. */}
        <div className="relative flex h-64 w-64 shrink-0 items-center justify-center landscape:col-start-2 landscape:row-start-1 landscape:h-72 landscape:w-72">
          {/* Ambient "breathing" glow behind the ring — a quiet sign the screen is alive, not static. */}
          <div className={`absolute h-48 w-48 rounded-full ${glowClass} blur-3xl transition-colors duration-1000 landscape:h-56 landscape:w-56`} style={{ animation: "focus-breathe 4s ease-in-out infinite" }} />

          <svg viewBox="0 0 260 260" className="relative h-64 w-64 -rotate-90 landscape:h-72 landscape:w-72">
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
            {!overTime && (
              <circle cx={dotX} cy={dotY} r="7" className={strokeClass} style={{ fill: "currentColor" }}>
                <animate attributeName="r" values="6;8;6" dur="1.6s" repeatCount="indefinite" />
              </circle>
            )}
          </svg>

          <div className="absolute flex flex-col items-center">
            <span className={`font-mono text-5xl font-bold tabular-nums transition-colors duration-500 ${textClass} landscape:text-6xl`}>
              {overTime ? `+${fmtClock(overSec)}` : fmtClock(remainingSec)}
            </span>
            <span className="mt-1 text-xs text-slate-500 landscape:text-sm">
              {overTime
                ? superAdmin
                  ? "সম্পন্ন হচ্ছে…"
                  : "অতিরিক্ত সময় — লক্ষ্য পার হয়েছে"
                : `বাকি আছে · লক্ষ্য ${targetMinutes} মিনিট`}
            </span>
          </div>

          {superAdmin && !overTime && (
            <div className="absolute -bottom-12 flex items-center gap-4 landscape:-bottom-16">
              <button
                type="button"
                onClick={() => adjustTime(-5)}
                disabled={adjustPending || targetMinutes <= 5}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-lg text-slate-300 transition-transform active:scale-95 disabled:opacity-30"
                aria-label="৫ মিনিট কমান"
              >
                −
              </button>
              <span className="text-xs text-slate-500">৫ মিনিট</span>
              <button
                type="button"
                onClick={() => adjustTime(5)}
                disabled={adjustPending || targetMinutes >= 600}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-lg text-slate-300 transition-transform active:scale-95 disabled:opacity-30"
                aria-label="৫ মিনিট বাড়ান"
              >
                +
              </button>
            </div>
          )}

          {/* Milestone toast — a brief, non-blocking nudge, not a dialog that breaks flow. */}
          {toast && (
            <div
              key={toast}
              className="absolute -top-3 left-1/2 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-full border border-white/10 bg-white/10 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-sm"
              style={{ animation: "focus-toast-in 0.3s ease-out" }}
            >
              {toast}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes focus-breathe { 0%,100% { transform: scale(0.92); opacity: 0.55; } 50% { transform: scale(1.06); opacity: 0.9; } }
        @keyframes focus-toast-in { from { opacity: 0; transform: translate(-50%, -80%); } to { opacity: 1; transform: translate(-50%, -100%); } }
      `}</style>

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
