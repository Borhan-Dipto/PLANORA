import { requireUserId } from "@/lib/session";
import { PageFrame } from "@/components/page-frame";
import { AiChat } from "@/components/planner/ai-chat";

export const instant = false;

export default async function AiPlannerPage() {
  await requireUserId();
  return (
    <PageFrame title="AI চ্যাট প্ল্যানার" back="/planner">
      <AiChat />
    </PageFrame>
  );
}
