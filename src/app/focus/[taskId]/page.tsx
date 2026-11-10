import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/session";
import { startFocusSession } from "@/lib/actions/focus";
import { FocusScreen } from "@/components/focus/focus-screen";

export default async function FocusPage({ params }: PageProps<"/focus/[taskId]">) {
  const { taskId } = await params;
  await requireUserId();
  if (!/^[0-9a-f-]{36}$/.test(taskId)) notFound();

  const res = await startFocusSession(taskId);
  if (!res.ok) notFound();

  return <FocusScreen session={res.session} />;
}
