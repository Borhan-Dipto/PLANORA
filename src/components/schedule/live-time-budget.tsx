"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ui, fmtMinutes } from "@/components/ui";

function parseTimeToday(hhmm: string, base: Date) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

function fmtClock(totalSeconds: number) {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/**
 * Live, second-by-second countdown of today's remaining awake time vs. remaining study time.
 * Awake window = [wakeTime, sleepTime) on the current calendar day (browser-local clock).
 */
export function LiveTimeBudget({
  wakeTime,
  sleepTime,
  studyRemainingMinutes,
}: {
  wakeTime: string | null;
  sleepTime: string | null;
  studyRemainingMinutes: number;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!wakeTime || !sleepTime) {
    return (
      <section className={`${ui.card} border-dashed text-center`}>
        <p className="text-sm text-muted">আজ কতটুকু জাগ্রত সময় বাকি আছে তা দেখতে আগে আপনার ঘুম থেকে ওঠা ও ঘুমানোর সময় সেট করুন।</p>
        <Link href="/settings" className={`${ui.btn} ${ui.primary} mt-3`}>
          সময় সেট করুন
        </Link>
      </section>
    );
  }

  if (!now) return null; // avoid a hydration mismatch — first real tick happens on the client

  const wake = parseTimeToday(wakeTime, now);
  const sleep = parseTimeToday(sleepTime, now);
  const totalAwakeMin = Math.max(1, Math.round((sleep.getTime() - wake.getTime()) / 60000));
  const awakeRemainingSec = Math.max(0, Math.round((sleep.getTime() - now.getTime()) / 1000));
  const awakeRemainingMin = awakeRemainingSec / 60;
  const studyMin = Math.max(0, studyRemainingMinutes);

  const studyDone = studyMin <= 0;
  const noTimeLeft = awakeRemainingMin <= 0;
  const ratio = awakeRemainingMin > 0 ? studyMin / awakeRemainingMin : studyMin > 0 ? Infinity : 0;

  let tone: "success" | "warning" | "error" = "success";
  let message = "";
  if (studyDone) {
    tone = "success";
    message = "🎉 আজকের সব পড়া শেষ — বাকি সময়টা নিজের মতো কাটান!";
  } else if (noTimeLeft) {
    tone = "error";
    message = "⏰ আজকের জাগ্রত সময় শেষ! এখনও পড়া বাকি আছে।";
  } else if (ratio >= 0.9) {
    tone = "error";
    message = "🔴 সময় কম, এখনই পড়া শুরু করুন!";
  } else if (ratio >= 0.55) {
    tone = "warning";
    message = "🟡 হাতে সময় কমে আসছে, দেরি করবেন না।";
  } else {
    tone = "success";
    message = "🟢 হাতে পর্যাপ্ত সময় আছে, নিশ্চিন্তে এগিয়ে যান।";
  }

  const toneClass = { success: "text-success", warning: "text-warning", error: "text-error" }[tone];
  const barClass = { success: "bg-success", warning: "bg-warning", error: "bg-error" }[tone];
  const freeRatio = Math.min(1, Math.max(0, 1 - studyMin / Math.max(totalAwakeMin, awakeRemainingMin, 1)));

  return (
    <section className={ui.card}>
      <h2 className="font-semibold">আজকের সময় বাজেট (লাইভ)</h2>
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div>
          <p className={`font-mono text-2xl font-bold tabular-nums ${noTimeLeft ? "text-error" : ""}`}>
            {fmtClock(awakeRemainingSec)}
          </p>
          <p className="mt-1 text-xs leading-tight text-muted">
            জাগ্রত সময় বাকি (রাত {sleepTime}-এ ঘুমাবেন ধরে)
          </p>
        </div>
        <div>
          <p className="text-2xl font-bold">{fmtMinutes(Math.round(studyMin))}</p>
          <p className="mt-1 text-xs leading-tight text-muted">আজ আর পড়তে হবে</p>
        </div>
      </div>
      <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-background">
        <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${Math.round(freeRatio * 100)}%` }} />
      </div>
      <p className={`mt-2 text-center text-sm font-medium ${toneClass}`}>{message}</p>
    </section>
  );
}
