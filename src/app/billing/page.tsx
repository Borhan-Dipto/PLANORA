import { requireUserId } from "@/lib/session";
import { getMyBilling } from "@/lib/actions/billing";
import { PageFrame } from "@/components/page-frame";
import { BkashPaymentForm, ActivationCodeForm } from "@/components/billing/billing-forms";
import { ui } from "@/components/ui";

const PAYMENT_STATUS_LABEL = { pending: "পর্যালোচনাধীন", approved: "গৃহীত", rejected: "বাতিল" } as const;
const PAYMENT_STATUS_CLASS = {
  pending: "text-warning",
  approved: "text-success",
  rejected: "text-error",
} as const;

export default async function BillingPage() {
  await requireUserId();
  const { tier, expiresAt, payments } = await getMyBilling();

  return (
    <PageFrame title="প্রিমিয়াম">
      <div className="space-y-4">
        <div className={`${ui.card} flex items-center justify-between`}>
          <div>
            <p className="text-sm text-muted">আপনার বর্তমান প্ল্যান</p>
            <p className="text-lg font-semibold">
              {tier === "premium" ? "💎 প্রিমিয়াম" : "ফ্রি"}
              {tier === "premium" && expiresAt && (
                <span className="ml-2 text-xs font-normal text-muted">{expiresAt.toLocaleDateString("bn-BD")} পর্যন্ত</span>
              )}
            </p>
          </div>
        </div>

        {tier === "free" && (
          <div className={ui.card}>
            <h2 className="font-semibold">প্রিমিয়ামে কী পাবেন</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-muted">
              <li>🔁 ইচ্ছেমতো রিভিশন দিন (৩–১০ দিন) — ফ্রিতে সবসময় ৩ দিন</li>
              <li>🤖 দিনে ১০০টি AI অনুরোধ — ফ্রিতে ১০টি</li>
              <li>🚀 ভবিষ্যতের সব প্রিমিয়াম ফিচার সবার আগে</li>
            </ul>
          </div>
        )}

        <BkashPaymentForm />
        <ActivationCodeForm />

        {payments.length > 0 && (
          <div className={ui.card}>
            <h2 className="mb-3 font-semibold">পেমেন্ট হিস্ট্রি</h2>
            <ul className="space-y-2">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 border-b border-border pb-2 text-sm last:border-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p>
                      {p.planLabel} · ৳{p.amountBdt}
                    </p>
                    <p className="text-xs text-muted">
                      {p.senderBkashNumber} · {p.transactionId} · {p.createdAt.toLocaleDateString("bn-BD")}
                    </p>
                    {p.status === "rejected" && p.reviewNote && <p className="text-xs text-error">কারণ: {p.reviewNote}</p>}
                  </div>
                  <span className={`shrink-0 text-xs font-medium ${PAYMENT_STATUS_CLASS[p.status]}`}>
                    {PAYMENT_STATUS_LABEL[p.status]}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </PageFrame>
  );
}
