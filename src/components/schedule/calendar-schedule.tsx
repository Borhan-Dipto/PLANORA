"use client";

import { useState } from "react";
import { WEEKDAY_LABEL, ui, fmtMinutes } from "@/components/ui";
import { TaskList, type TaskItem } from "@/components/schedule/task-list";

const BN_MONTH = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

const iso = (y: number, m: number, day: number) => {
  const mm = String(m + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
};

/**
 * Calendar-style preview of the whole cycle: a month grid with a dot on every day that has
 * something scheduled, click a date to see exactly what the engine put there. Used both for an
 * already-active plan (real plan_tasks) and for a still-unsaved draft (a pure in-memory preview
 * computed from the current plan data) — `readOnly` and `editableFrom` decide whether a day's
 * tasks can be checked off.
 */
export function CalendarSchedule({
  tasksByDate,
  startDate,
  endDate,
  today,
  editable,
}: {
  tasksByDate: Record<string, TaskItem[]>;
  startDate: string;
  endDate: string;
  today: string;
  /** false ⇒ nothing here is interactive (draft preview, or a completed/archived plan). */
  editable: boolean;
}) {
  const [selected, setSelected] = useState(() => (today >= startDate && today <= endDate ? today : startDate));

  const months: { year: number; month: number }[] = [];
  {
    const end = new Date(endDate + "T00:00:00Z");
    let cur = new Date(startDate + "T00:00:00Z");
    cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth(), 1));
    while (cur <= end) {
      months.push({ year: cur.getUTCFullYear(), month: cur.getUTCMonth() });
      cur = new Date(Date.UTC(cur.getUTCFullYear(), cur.getUTCMonth() + 1, 1));
    }
  }

  const selectedTasks = tasksByDate[selected] ?? [];
  const selectedMinutes = selectedTasks.reduce((n, t) => n + t.minutes, 0);
  const selectedReadOnly = !editable || selected > today;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {months.map(({ year, month }) => {
          const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
          const leadDays = new Date(Date.UTC(year, month, 1)).getUTCDay();
          const cells: (string | null)[] = [...Array(leadDays).fill(null)];
          for (let day = 1; day <= daysInMonth; day++) cells.push(iso(year, month, day));

          return (
            <div key={`${year}-${month}`} className={ui.card}>
              <p className="mb-2 text-sm font-semibold">
                {BN_MONTH[month]} {year}
              </p>
              <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted">
                {WEEKDAY_LABEL.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div className="mt-1 grid grid-cols-7 gap-1">
                {cells.map((date, i) => {
                  if (!date) return <span key={`blank-${i}`} />;
                  const inRange = date >= startDate && date <= endDate;
                  const minutes = tasksByDate[date]?.reduce((n, t) => n + t.minutes, 0) ?? 0;
                  const isToday = date === today;
                  const isSelected = date === selected;
                  return (
                    <button
                      key={date}
                      type="button"
                      disabled={!inRange}
                      onClick={() => setSelected(date)}
                      className={`flex aspect-square flex-col items-center justify-center rounded-lg border text-xs transition ${
                        !inRange
                          ? "border-transparent text-muted/40"
                          : isSelected
                            ? "border-accent bg-accent text-accent-foreground"
                            : isToday
                              ? "border-accent/60 text-accent"
                              : "border-border hover:border-accent"
                      }`}
                    >
                      <span>{Number(date.slice(-2))}</span>
                      {inRange && minutes > 0 && (
                        <span className={`mt-0.5 h-1 w-1 rounded-full ${isSelected ? "bg-accent-foreground" : "bg-accent"}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className={ui.card}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold">
            {WEEKDAY_LABEL[new Date(selected + "T00:00:00Z").getUTCDay()]}, {selected}
            {selected === today && <span className="ml-1.5 text-xs text-accent">· আজ</span>}
          </h3>
          {selectedMinutes > 0 && <span className="text-xs text-muted">{fmtMinutes(selectedMinutes)}</span>}
        </div>
        {selectedTasks.length ? (
          <TaskList tasks={selectedTasks} readOnly={selectedReadOnly} />
        ) : (
          <p className="text-xs text-muted">বিশ্রাম / কোনো পড়া নেই</p>
        )}
      </div>
    </div>
  );
}
