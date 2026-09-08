import { createBrowserClient } from "@supabase/ssr";

// Note: we intentionally do not pass the generated `Database` generic here.
// The hand-authored types in `types/database.types.ts` are used directly in
// server actions and components for shape-checking inputs/outputs, while the
// raw Supabase client stays loosely typed to avoid brittle generic inference
// against RPCs defined only in SQL. Regenerate with the Supabase CLI once a
// live project exists for full end-to-end type safety.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
