"use client";

import { useEffect, useState } from "react";

const WEEKDAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

/** Live, second-by-second wall clock + today's date. */
export function LiveClock({ className = "" }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    // First tick lands within 1s of mount — no synchronous setState in the effect body itself.
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <div className={className} />; // avoid hydration mismatch

  let h = now.getHours();
  const period = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  const time = `${h}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  return (
    <div className={`flex items-center justify-between gap-2 ${className}`}>
      <span className="text-sm text-muted">
        {WEEKDAYS[now.getDay()]}, {now.getDate()} {MONTHS[now.getMonth()]}
      </span>
      <span className="font-mono text-xl font-bold tabular-nums">
        {time} <span className="text-sm font-normal text-muted">{period}</span>
      </span>
    </div>
  );
}
