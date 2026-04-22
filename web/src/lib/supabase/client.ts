// Supabase client for the browser. Public key only — RLS is the real gate.
// Accepts either the new publishable key (`sb_publishable_*`) or the legacy
// anon JWT (`eyJ*`); Supabase still recognises both.

import { createBrowserClient } from "@supabase/ssr";

function publicKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    ""
  );
}

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    publicKey(),
  );
}

// Convenience singleton for most client components.
export const supabase =
  typeof window !== "undefined" &&
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  publicKey()
    ? createClient()
    : null;
