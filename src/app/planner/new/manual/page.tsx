import { requireUserId } from "@/lib/session";
import { getUserTier } from "@/lib/plan/tier";
import { emptyPlan } from "@/lib/plan/schema";
import { PageFrame } from "@/components/page-frame";
import { PlanEditor } from "@/components/planner/plan-editor";

export default async function ManualPlannerPage() {
  const userId = await requireUserId();
  const tier = await getUserTier(userId);
  return (
    <PageFrame title="ম্যানুয়াল প্ল্যান" back="/planner">
      <PlanEditor initial={emptyPlan()} planId={null} source="manual" isPremium={tier === "premium"} />
    </PageFrame>
  );
}
