"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approvePlan, archivePlan, deletePlan, duplicatePlan } from "@/lib/actions/plans";
import { ui } from "@/components/ui";

export function PlanActions({
  id,
  status,
  canApprove,
}: {
  id: string;
  status: "draft" | "active" | "completed" | "archived";
  canApprove: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<null | "delete" | "archive">(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string; id?: string }>, after?: (id?: string) => void) =>
    start(async () => {
      setError("");
      const res = await fn();
      if (!res.ok) return setError(res.error ?? "সমস্যা হয়েছে");
      setConfirm(null);
      after?.(res.id);
      router.refresh();
    });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
        {status === "draft" && (
          <>
            <button
              disabled={pending || !canApprove}
              onClick={() => run(() => approvePlan(id))}
              className={`${ui.btn} ${ui.primary}`}
            >
              ✓ অনুমোদন দিন ও শুরু করুন
            </button>
            <Link href={`/planner/${id}/edit`} className={`${ui.btn} ${ui.secondary}`}>
              ✎ এডিট
            </Link>
            {confirm === "delete" ? (
              <button
                disabled={pending}
                onClick={() => run(() => deletePlan(id), () => router.push("/planner"))}
                className={`${ui.btn} ${ui.danger}`}
              >
                নিশ্চিত, মুছুন
              </button>
            ) : (
              <button onClick={() => setConfirm("delete")} className={`${ui.btn} ${ui.danger}`}>
                মুছুন
              </button>
            )}
          </>
        )}
        {status === "active" &&
          (confirm === "archive" ? (
            <button disabled={pending} onClick={() => run(() => archivePlan(id))} className={`${ui.btn} ${ui.danger}`}>
              নিশ্চিত, আর্কাইভ করুন
            </button>
          ) : (
            <button onClick={() => setConfirm("archive")} className={`${ui.btn} ${ui.secondary}`}>
              আর্কাইভ করুন
            </button>
          ))}
        {(status === "completed" || status === "archived") && (
          <button
            disabled={pending}
            onClick={() => run(() => duplicatePlan(id), (newId) => newId && router.push(`/planner/${newId}`))}
            className={`${ui.btn} ${ui.primary}`}
          >
            ↻ আবার এই প্ল্যান করুন
          </button>
        )}
      </div>
      {error && <p className="text-sm text-error">{error}</p>}
    </div>
  );
}
