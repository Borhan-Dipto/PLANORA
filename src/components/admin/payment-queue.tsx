"use client";

import { useState, useTransition } from "react";
import { approvePayment, rejectPayment } from "@/lib/actions/admin";
import { ui } from "@/components/ui";

export type AdminPaymentRow = {
  id: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  planLabel: string;
  amountBdt: number;
  durationDays: number;
  senderBkashNumber: string;
  transactionId: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
};

export function PaymentQueue({ payments }: { payments: AdminPaymentRow[] }) {
  if (!payments.length) return <p className="text-sm text-muted">পর্যালোচনার জন্য কোনো পেমেন্ট নেই। 🎉</p>;
  return (
    <ul className="space-y-3">
      {payments.map((p) => (
        <PaymentRow key={p.id} payment={p} />
      ))}
    </ul>
  );
}

function PaymentRow({ payment: p }: { payment: AdminPaymentRow }) {
  const [pending, start] = useTransition();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<"approved" | "rejected" | null>(null);

  const approve = () =>
    start(async () => {
      const r = await approvePayment(p.id);
      if (r.ok) setDone("approved");
      else setError(r.error);
    });

  const reject = () =>
    start(async () => {
      const r = await rejectPayment(p.id, reason);
      if (r.ok) setDone("rejected");
      else setError(r.error);
    });

  if (done) {
    return (
      <li className="rounded-lg border border-border p-3 text-sm text-muted">
        {p.planLabel} · {p.displayName || p.email} — {done === "approved" ? "✓ গৃহীত হয়েছে" : "বাতিল করা হয়েছে"}
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-border p-3">
      <div className="flex flex-wrap items-start justify-between gap-2 text-sm">
        <div>
          <p className="font-medium">
            {p.displayName || p.email} · {p.planLabel} (৳{p.amountBdt})
          </p>
          <p className="text-xs text-muted">
            বিকাশ: {p.senderBkashNumber} · TrxID: <b>{p.transactionId}</b> · {p.createdAt.toLocaleString("bn-BD")}
          </p>
        </div>
      </div>
      {error && <p className="mt-1 text-xs text-error">{error}</p>}
      {!rejecting ? (
        <div className="mt-2 flex gap-2">
          <button disabled={pending} onClick={approve} className={`${ui.btn} ${ui.primary} px-3 py-1.5 text-xs`}>
            {pending ? "…" : "✓ অনুমোদন"}
          </button>
          <button disabled={pending} onClick={() => setRejecting(true)} className={`${ui.btn} ${ui.danger} px-3 py-1.5 text-xs`}>
            ✕ বাতিল
          </button>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap gap-2">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="বাতিলের কারণ (ঐচ্ছিক)"
            className={`${ui.input} flex-1`}
          />
          <button disabled={pending} onClick={reject} className={`${ui.btn} ${ui.danger} px-3 py-1.5 text-xs`}>
            {pending ? "…" : "নিশ্চিত বাতিল"}
          </button>
          <button disabled={pending} onClick={() => setRejecting(false)} className={`${ui.btn} ${ui.secondary} px-3 py-1.5 text-xs`}>
            ফিরে যান
          </button>
        </div>
      )}
    </li>
  );
}
