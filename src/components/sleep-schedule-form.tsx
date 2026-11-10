"use client";

import { useState, useTransition } from "react";
import { setSleepSchedule } from "@/lib/actions/sleep-schedule";
import { ui } from "@/components/ui";

export function SleepScheduleForm({ wakeTime, sleepTime }: { wakeTime: string | null; sleepTime: string | null }) {
  const [wake, setWake] = useState(wakeTime ?? "06:00");
  const [sleep, setSleep] = useState(sleepTime ?? "23:00");
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const save = () =>
    start(async () => {
      setError("");
      const res = await setSleepSchedule(wake, sleep);
      if (!res.ok) return setError(res.error);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    });

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="font-medium">ঘুম থেকে ওঠা ও ঘুমানোর সময়</p>
      <p className="mt-1 text-xs text-muted">
        ড্যাশবোর্ডে আজ কতটুকু জাগ্রত সময় বাকি আছে, তা লাইভ দেখানোর জন্য দরকার।
      </p>
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <label className={ui.label}>ঘুম থেকে ওঠার সময়</label>
          <input type="time" className={ui.input} value={wake} onChange={(e) => setWake(e.target.value)} />
        </div>
        <div>
          <label className={ui.label}>ঘুমাতে যাওয়ার সময়</label>
          <input type="time" className={ui.input} value={sleep} onChange={(e) => setSleep(e.target.value)} />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
      <button onClick={save} disabled={pending} className={`${ui.btn} ${ui.primary} mt-3`}>
        {pending ? "সেভ হচ্ছে…" : saved ? "✓ সেভ হয়েছে" : "সেভ করুন"}
      </button>
    </div>
  );
}
