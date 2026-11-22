import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { liveAuthEnabled, liveAuthUnavailable } from "@/lib/auth-mode";

export async function createClient() {
  const cookieStore = await cookies();
  if (!liveAuthEnabled()) throw new Error(liveAuthUnavailable);

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // called from a Server Component with no write access — safe to ignore
            // when middleware is refreshing the session.
          }
        },
      },
    }
  );
}
