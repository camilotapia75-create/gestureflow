import { createBrowserClient } from '@supabase/ssr';

// Singleton factory — safe to call multiple times (SSR-aware).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
