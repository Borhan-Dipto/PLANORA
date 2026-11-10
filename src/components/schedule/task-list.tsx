"use client";

import { useOptimistic, useTransition } from "react";
import { setTaskDone } from "@/lib/actions/schedule";
import { fmtMinutes } from "@/components/ui";

export type TaskItem = {
  id: string;
  kind: "study" | "habit" | "revision";
  title: string;
  subjectName: string | null;
  minutes: number;
  part: number;
  parts: number;
  status: "pending" | "done" | "skipped";
};

export function TaskList({ tasks, readOnly = false }: { tasks: TaskItem[]; readOnly?: boolean }) {
  const [, start] = useTransition();
  const [items, setOptimistic] = useOptimistic(tasks, (cur, { id, done }: { id: string; done: boolean }) =>
    cur.map((t) => (t.id === id ? { ...t, status: done ? "done" : "pending" } as TaskItem : t))
  );

  const toggle = (t: TaskItem) => {
    if (readOnly) return;
    const done = t.status !== "done";
    start(async () => {
      setOptimistic({ id: t.id, done });
      await setTaskDone(t.id, done);
    });
  };

  return (
    <ul className="space-y-2">
      {items.map((t) => {
        const done = t.status === "done";
        return (
          <li key={t.id}>
            <button
              type="button"
              onClick={() => toggle(t)}
              disabled={readOnly}
              aria-pressed={done}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                done ? "border-success/30 bg-success/5" : "border-border bg-surface hover:border-accent"
              } ${readOnly ? "cursor-default" : ""}`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                  done ? "border-success bg-success text-white" : "border-border"
                }`}
              >
                {done && "✓"}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block break-words text-sm ${done ? "text-muted line-through" : ""}`}>
                  {t.kind === "habit" && "🔁 "}
                  {t.title}
                  {t.parts > 1 && <span className="text-muted"> (অংশ {t.part}/{t.parts})</span>}
                </span>
                {t.subjectName && <span className="mt-0.5 block truncate text-xs text-muted">{t.subjectName}</span>}
              </span>
              {t.minutes > 0 && <span className="shrink-0 text-xs text-muted">{fmtMinutes(t.minutes)}</span>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
