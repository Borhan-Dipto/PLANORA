import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // manifest.json must bypass auth entirely: Chrome's install-prompt check fetches it with no
  // session cookies, and before this exclusion it was redirected to /login (HTML instead of JSON),
  // which is exactly what made Chrome report "this app can't be installed."
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
