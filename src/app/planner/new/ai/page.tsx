import { requireUserId, isSuperAdmin } from "@/lib/session";
import { MIN_LEARNING_DAYS, MAX_LEARNING_DAYS } from "@/lib/plan/schema";
import { PageFrame } from "@/components/page-frame";
import { AiChat } from "@/components/planner/ai-chat";

export const maxDuration = 120;

export default async function AiPlannerPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const userId = await requireUserId();
  const [superAdmin, { days }] = await Promise.all([isSuperAdmin(userId), searchParams]);

  // Only the super_admin may arrive here with a non-default duration already chosen on /planner.
  const requested = Number(days);
  const learningDays =
    superAdmin && Number.isInteger(requested) && requested >= MIN_LEARNING_DAYS && requested <= MAX_LEARNING_DAYS
      ? requested
      : undefined;

  return (
    <PageFrame title="AI চ্যাট প্ল্যানার" back="/planner">
      <AiChat learningDays={learningDays} />
    </PageFrame>
  );
}
