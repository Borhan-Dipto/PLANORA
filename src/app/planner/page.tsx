import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db, withDbRetry } from "@/db/client";
import { plans } from "@/db/schema";
import { requireUserId, isSuperAdmin } from "@/lib/session";
import { PageFrame } from "@/components/page-frame";
import { NewPlanOptions } from "@/components/planner/new-plan-options";
import { ui, STATUS_LABEL, SOURCE_LABEL } from "@/components/ui";

const STATUS_TONE = {
  draft: "bg-warning/15 text-warning",
  active: "bg-success/15 text-success",
  completed: "bg-accent/15 text-accent",
  archived: "bg-muted/15 text-muted",
} as const;

export default async function PlannerPage() {
  const userId = await requireUserId();
  const [rows, superAdmin] = await Promise.all([
    withDbRetry(() =>
      db
        .select({ id: plans.id, title: plans.title, status: plans.status, source: plans.source, startDate: plans.startDate, updatedAt: plans.updatedAt })
        .from(plans)
        .where(and(eq(plans.userId, userId)))
        .orderBy(desc(plans.updatedAt)),
    ),
    isSuperAdmin(userId),
  ]);

  return (
    <PageFrame title="প্ল্যানার">
      <h2 className="mb-3 font-semibold">নতুন প্ল্যান বানান</h2>
      <NewPlanOptions isSuperAdmin={superAdmin} />

      <h2 className="mb-3 mt-8 font-semibold">আমার প্ল্যানগুলো</h2>
      {rows.length === 0 ? (
        <div className={`${ui.card} text-center text-sm text-muted`}>এখনো কোনো প্ল্যান নেই — উপরের যেকোনো একটি দিয়ে শুরু করুন।</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/planner/${p.id}`} className={`${ui.card} flex flex-wrap items-center gap-2 p-3 hover:border-accent sm:p-4`}>
                <span className="min-w-0 flex-1 truncate font-medium">{p.title}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_TONE[p.status]}`}>{STATUS_LABEL[p.status]}</span>
                <span className="w-full text-xs text-muted sm:w-auto">
                  {SOURCE_LABEL[p.source]} · শুরু {p.startDate}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageFrame>
  );
}
