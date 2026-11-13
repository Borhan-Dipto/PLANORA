import { requireUserId, isSuperAdmin } from "@/lib/session";
import { getUserTier } from "@/lib/plan/tier";
import { emptyPlan, MIN_LEARNING_DAYS, MAX_LEARNING_DAYS } from "@/lib/plan/schema";
import { PageFrame } from "@/components/page-frame";
import { PlanEditor } from "@/components/planner/plan-editor";

export default async function ManualPlannerPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const userId = await requireUserId();
  const [tier, superAdmin, { days }] = await Promise.all([getUserTier(userId), isSuperAdmin(userId), searchParams]);

  const initial = emptyPlan();
  // Only the super_admin may arrive here with a non-default duration already chosen on /planner.
  const requested = Number(days);
  if (superAdmin && Number.isInteger(requested) && requested >= MIN_LEARNING_DAYS && requested <= MAX_LEARNING_DAYS) {
    initial.learningDays = requested;
  }

  return (
    <PageFrame title="ম্যানুয়াল প্ল্যান" back="/planner">
      <PlanEditor initial={initial} planId={null} source="manual" isPremium={tier === "premium"} isSuperAdmin={superAdmin} />
    </PageFrame>
  );
}
