import { redirect } from "next/navigation";
import { requireUserId, isSuperAdmin } from "@/lib/session";
import { getActiveFocusSession } from "@/lib/actions/focus";
import { FocusScreen } from "@/components/focus/focus-screen";

/** Resume whatever focus session is currently active, regardless of which task started it. */
export default async function ResumeFocusPage() {
  const userId = await requireUserId();
  const [session, superAdmin] = await Promise.all([getActiveFocusSession(), isSuperAdmin(userId)]);
  if (!session) redirect("/dashboard");
  return <FocusScreen session={session} superAdmin={superAdmin} />;
}
