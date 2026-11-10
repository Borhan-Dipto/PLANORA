import { requireUserId } from "@/lib/session";
import { PageFrame } from "@/components/page-frame";
import { AutoPlannerForm } from "@/components/planner/auto-planner-form";

export const instant = false;
export const maxDuration = 120;

export default async function AutoPlannerPage() {
  await requireUserId();
  return (
    <PageFrame title="অটোমেটিক প্ল্যানার" back="/planner">
      <AutoPlannerForm />
    </PageFrame>
  );
}
