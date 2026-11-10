import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { getActiveFocusSession } from "@/lib/actions/focus";
import { FocusScreen } from "@/components/focus/focus-screen";

/** Resume whatever focus session is currently active, regardless of which task started it. */
export default async function ResumeFocusPage() {
  await requireUserId();
  const session = await getActiveFocusSession();
  if (!session) redirect("/dashboard");
  return <FocusScreen session={session} />;
}
