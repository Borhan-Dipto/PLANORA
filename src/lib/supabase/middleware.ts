import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not remove. Refreshes the auth token.
  const { data: { user } } = await supabase.auth.getUser();

  const isAuthRoute = ["/login", "/register", "/verify", "/auth"].some((p) =>
    request.nextUrl.pathname.startsWith(p)
  );
  const isPublicRoute = request.nextUrl.pathname === "/" || request.nextUrl.pathname.startsWith("/pricing");
  const isAdminRoute = request.nextUrl.pathname.startsWith("/admin");

  if (!user && !isAuthRoute && !isPublicRoute && !isAdminRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
