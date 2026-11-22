import { NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  // Member routes contain only local demo data and never grant admin access.
  const path = request.nextUrl.pathname;
  if (path === "/member" || path.startsWith("/member/") || path === "/demo" || path.startsWith("/platform")) return NextResponse.next({ request });
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
