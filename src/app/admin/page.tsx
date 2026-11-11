import { requireAdminId } from "@/lib/session";
import { getAdminOverview, listUsers, listPayments, listActivationCodes, listAuditLog } from "@/lib/actions/admin";
import { PageFrame } from "@/components/page-frame";
import { UserTable } from "@/components/admin/user-table";
import { PaymentQueue } from "@/components/admin/payment-queue";
import { CodeGenerator } from "@/components/admin/code-generator";
import { ui } from "@/components/ui";

const AUDIT_ACTION_LABEL: Record<string, string> = {
  "user.suspend": "ইউজার সাসপেন্ড",
  "user.unsuspend": "ইউজার আনসাসপেন্ড",
  "payment.approve": "পেমেন্ট অনুমোদন",
  "payment.reject": "পেমেন্ট বাতিল",
  "code.create": "কোড তৈরি",
  "role.change": "রোল পরিবর্তন",
};

export default async function AdminPage() {
  const { role: viewerRole } = await requireAdminId();

  const [overview, users, pendingPayments, reviewedPayments, codes, audit] = await Promise.all([
    getAdminOverview(),
    listUsers(),
    listPayments("pending"),
    listPayments(),
    listActivationCodes(),
    listAuditLog(),
  ]);

  return (
    <PageFrame title="অ্যাডমিন ড্যাশবোর্ড">
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="মোট ইউজার" value={overview.users} />
          <Stat label="প্রিমিয়াম" value={overview.premium} />
          <Stat label="চলমান প্ল্যান" value={overview.activePlans} />
          <Stat label="পেন্ডিং পেমেন্ট" value={overview.pendingPayments} accent={overview.pendingPayments > 0} />
          <Stat label="AI কল (২৪ঘ.)" value={overview.aiToday} />
        </div>

        <section className={ui.card}>
          <h2 className="mb-3 font-semibold">💳 পেমেন্ট পর্যালোচনা</h2>
          <PaymentQueue payments={pendingPayments} />
        </section>

        <section className={ui.card}>
          <h2 className="mb-3 font-semibold">🎟️ অ্যাক্টিভেশন কোড</h2>
          <CodeGenerator codes={codes} />
        </section>

        <UserTable users={users} canManageRoles={viewerRole === "super_admin"} />

        {reviewedPayments.length > 0 && (
          <section className={ui.card}>
            <h2 className="mb-3 font-semibold">পেমেন্ট হিস্ট্রি (সব)</h2>
            <ul className="space-y-1.5 text-sm">
              {reviewedPayments.slice(0, 20).map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1.5 last:border-0">
                  <span className="text-muted">
                    {p.displayName || p.email} · {p.planLabel} · ৳{p.amountBdt}
                  </span>
                  <span
                    className={
                      p.status === "approved" ? "text-xs text-success" : p.status === "rejected" ? "text-xs text-error" : "text-xs text-warning"
                    }
                  >
                    {p.status === "approved" ? "গৃহীত" : p.status === "rejected" ? "বাতিল" : "পর্যালোচনাধীন"}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={ui.card}>
          <h2 className="mb-3 font-semibold">অডিট লগ</h2>
          {!audit.length ? (
            <p className="text-sm text-muted">এখনো কোনো অ্যাডমিন অ্যাকশন হয়নি।</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {audit.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-1.5 last:border-0">
                  <span>
                    {AUDIT_ACTION_LABEL[a.action] ?? a.action} <span className="text-xs text-muted">— {a.actorEmail}</span>
                  </span>
                  <span className="text-xs text-muted">{a.createdAt.toLocaleString("bn-BD")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </PageFrame>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={ui.card}>
      <p className="text-xs text-muted">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent ? "text-warning" : ""}`}>{value}</p>
    </div>
  );
}
