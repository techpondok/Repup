import { NextResponse, type NextRequest } from "next/server";
import { isAuthCookie, liveAuthEnabled } from "@/lib/auth-mode";

const publicPaths = ["/", "/login", "/register", "/forgot-password", "/reset-password", "/auth/callback"];

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const isPublic = publicPaths.includes(path);
  if (path === "/" || (process.env.APP_DEMO_ENABLED !== "false" && request.cookies.get("ru_demo")?.value === "1")) {
    return NextResponse.next({ request });
  }

  let sessionResponse = NextResponse.next({ request });
  function redirectTo(pathname: string) {
    const url = request.nextUrl.clone();
    url.pathname = pathname;
    url.search = "";
    const response = NextResponse.redirect(url);
    sessionResponse.cookies.getAll().forEach(cookie => response.cookies.set(cookie));
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  }

  if (!liveAuthEnabled() || !request.cookies.getAll().some(cookie => isAuthCookie(cookie.name))) {
    return isPublic ? sessionResponse : redirectTo("/login");
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("[AUTH][PROXY] Live auth configuration is missing.");
    return isPublic ? sessionResponse : redirectTo("/login");
  }

  try {
    const { createServerClient } = await import("@supabase/ssr");
    const client = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          sessionResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => sessionResponse.cookies.set(name, value, options));
          Object.entries(headers).forEach(([name, value]) => sessionResponse.headers.set(name, value));
        },
      },
    });

    const { data: { user }, error } = await client.auth.getUser();
    if ((!user || error) && !isPublic) return redirectTo("/login");
    if (user && !error && (path === "/login" || path === "/register")) return redirectTo("/dashboard");
    return sessionResponse;
  } catch {
    console.error("[AUTH][PROXY] Live session validation failed.");
    return isPublic ? sessionResponse : redirectTo("/login");
  }
}
