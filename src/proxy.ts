import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // manifest.json, sw.js and offline.html must all bypass auth entirely: Chrome's install-prompt
  // check and the service worker itself fetch these with no session cookies, and without this
  // exclusion they were redirected to /login (HTML instead of JSON/JS), which is exactly what made
  // Chrome report "this app can't be installed" and would have made sw.js fail to register.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|offline.html|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
