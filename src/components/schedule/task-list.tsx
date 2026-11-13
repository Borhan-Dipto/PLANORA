"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import { setTaskDone } from "@/lib/actions/schedule";
import { groupBySubject } from "@/lib/schedule/group";
import { fmtMinutes } from "@/components/ui";

export type TaskItem = {
  id: string;
  kind: "study" | "habit" | "revision" | "break";
  title: string;
  subjectName: string | null;
  minutes: number;
  part: number;
  parts: number;
  status: "pending" | "done" | "skipped";
};

/** showFocusStart: only true for today's own list — past/future days and read-only views don't get it. */
export function TaskList({
  tasks,
  readOnly = false,
  showFocusStart = false,
}: {
  tasks: TaskItem[];
  readOnly?: boolean;
  showFocusStart?: boolean;
}) {
  const [, start] = useTransition();
  const [items, setOptimistic] = useOptimistic(
    tasks,
    (cur, { id, done }: { id: string; done: boolean }) =>
      cur.map((t) =>
        t.id === id
          ? ({ ...t, status: done ? "done" : "pending" } as TaskItem)
          : t,
      ),
  );

  const toggle = (t: TaskItem) => {
    if (readOnly || t.kind === "break") return;
    const done = t.status !== "done";
    start(async () => {
      setOptimistic({ id: t.id, done });
      await setTaskDone(t.id, done);
    });
  };

  const groups = groupBySubject(items);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.name}>
          <div className="mb-1.5 flex items-center gap-2 text-xs font-semibold text-muted">
            <span className="min-w-0 flex-1 truncate">{g.name}</span>
            {g.minutes > 0 && (
              <span className="shrink-0 font-normal">
                {fmtMinutes(g.minutes)}
              </span>
            )}
          </div>
          <ul className="space-y-2">
            {g.tasks.map((t) => {
              if (t.kind === "break") {
                return (
                  <li
                    key={t.id}
                    className="flex items-center gap-3 rounded-lg border border-dashed border-border bg-transparent p-3 text-sm text-muted"
                  >
                    🌴 {t.title}
                  </li>
                );
              }
              const done = t.status === "done";
              const canFocus =
                showFocusStart &&
                !readOnly &&
                (t.kind === "study" || t.kind === "revision") &&
                !done;
              return (
                <li key={t.id} className="flex items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => toggle(t)}
                    disabled={readOnly}
                    aria-pressed={done}
                    className={`flex min-w-0 flex-1 items-start gap-3 rounded-lg border p-3 text-left transition ${
                      done
                        ? "border-success/30 bg-success/5"
                        : "border-border bg-surface hover:border-accent"
                    } ${readOnly ? "cursor-default" : ""}`}
                  >
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-xs ${
                        done
                          ? "border-success bg-success text-white"
                          : "border-border"
                      }`}
                    >
                      {done && "✓"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className={`block break-words text-sm ${done ? "text-muted line-through" : ""}`}
                      >
                        {t.kind === "habit" && "🔁 "}
                        {t.title}
                        {t.parts > 1 && (
                          <span className="text-muted">
                            {" "}
                            (অংশ {t.part}/{t.parts})
                          </span>
                        )}
                      </span>
                    </span>
                    {t.minutes > 0 && (
                      <span className="shrink-0 text-xs text-muted">
                        {fmtMinutes(t.minutes)}
                      </span>
                    )}
                  </button>
                  {canFocus && (
                    <Link
                      href={`/focus/${t.id}`}
                      className="flex shrink-0 items-center rounded-lg bg-accent px-3 text-sm font-medium text-accent-foreground"
                      aria-label="ফোকাস মোডে শুরু করুন"
                    >
                      ▶
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
