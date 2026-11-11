import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { db, withDbRetry } from "@/db/client";
import { plans } from "@/db/schema";
import { requireUserId } from "@/lib/session";
import { getUserTier } from "@/lib/plan/tier";
import { todayFor } from "@/lib/schedule/service";
import { PageFrame } from "@/components/page-frame";
import { PlanEditor } from "@/components/planner/plan-editor";

export default async function EditPlanPage({ params }: PageProps<"/planner/[id]/edit">) {
  const { id } = await params;
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [plan] = await withDbRetry(() => db.select().from(plans).where(and(eq(plans.id, id), eq(plans.userId, userId))));
  if (!plan) notFound();
  if (plan.status !== "draft" && plan.status !== "active") redirect(`/planner/${id}`);
  const tier = await getUserTier(userId);
  return (
    <PageFrame title="প্ল্যান এডিট" back={`/planner/${id}`}>
      <PlanEditor
        initial={plan.planData}
        planId={id}
        source={plan.source}
        isPremium={tier === "premium"}
        active={plan.status === "active"}
        todayIso={await todayFor(userId)}
      />
    </PageFrame>
  );
}
