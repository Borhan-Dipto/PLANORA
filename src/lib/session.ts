import "server-only";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Returns the signed-in user's id or redirects to /login. */
export async function requireUserId() {
  await connection(); // request-time only (avoids Date.now() prerender errors from the auth client)
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user.id;
}
