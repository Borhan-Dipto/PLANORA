"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { approvePlan, archivePlan, deletePlan, duplicatePlan } from "@/lib/actions/plans";
import { ui } from "@/components/ui";

export function PlanActions({
  id,
  title,
  status,
  canApprove,
}: {
  id: string;
  title: string;
  status: "draft" | "active" | "completed" | "archived";
  canApprove: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<null | "archive">(null);
  const [showDelete, setShowDelete] = useState(false);
  const [typed, setTyped] = useState("");
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
            <Link href={`/planner/${id}/schedule`} className={`${ui.btn} ${ui.secondary}`}>
              📅 দিনভিত্তিক শিডিউল দেখুন
            </Link>
            <Link href={`/planner/${id}/edit`} className={`${ui.btn} ${ui.secondary}`}>
              ✎ এডিট
            </Link>
          </>
        )}
        {status === "active" && (
          <>
            <Link href={`/planner/${id}/schedule`} className={`${ui.btn} ${ui.primary}`}>
              📅 সময়সূচি
            </Link>
            <Link href={`/planner/${id}/edit`} className={`${ui.btn} ${ui.secondary}`}>
              ✎ এডিট
            </Link>
          </>
        )}
        {(status === "completed" || status === "archived") && (
          <Link href={`/planner/${id}/schedule`} className={`${ui.btn} ${ui.secondary}`}>
            📅 সময়সূচি
          </Link>
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

      <div className="rounded-lg border border-error/30 p-3">
        {!showDelete ? (
          <button
            type="button"
            onClick={() => setShowDelete(true)}
            className="text-sm text-error hover:underline"
          >
            🗑️ পুরো প্ল্যান একদম মুছে ফেলুন
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-error">
              এটা স্থায়ীভাবে মুছে যাবে — এই প্ল্যানের সব বিষয়, টপিক, শিডিউল ও অগ্রগতি একদম হারিয়ে যাবে, আর ফেরত আনা যাবে না।
            </p>
            <p className="text-xs text-muted">
              নিশ্চিত করতে নিচে প্ল্যানের নামটা হুবহু লিখুন: <span className="font-semibold text-foreground">{title}</span>
            </p>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={title}
              className={ui.input}
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || typed !== title}
                onClick={() => run(() => deletePlan(id), () => router.push("/planner"))}
                className={`${ui.btn} ${ui.danger}`}
              >
                স্থায়ীভাবে মুছে ফেলুন
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDelete(false);
                  setTyped("");
                }}
                className={`${ui.btn} ${ui.secondary}`}
              >
                বাতিল
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
