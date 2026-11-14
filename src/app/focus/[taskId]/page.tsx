import { notFound } from "next/navigation";
import { requireUserId, isSuperAdmin } from "@/lib/session";
import { startFocusSession } from "@/lib/actions/focus";
import { FocusScreen } from "@/components/focus/focus-screen";

export default async function FocusPage({ params }: PageProps<"/focus/[taskId]">) {
  const { taskId } = await params;
  const userId = await requireUserId();
  if (!/^[0-9a-f-]{36}$/.test(taskId)) notFound();

  const [res, superAdmin] = await Promise.all([startFocusSession(taskId), isSuperAdmin(userId)]);
  if (!res.ok) notFound();

  return <FocusScreen session={res.session} superAdmin={superAdmin} />;
}
