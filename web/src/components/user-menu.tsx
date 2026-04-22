"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

// Small GitHub sign-in affordance for the nav. When signed in, swaps in a
// compact avatar + name pill with a dropdown Sign out.

export function UserMenu({ compact = false }: { compact?: boolean }) {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser(data.user);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // No Supabase configured at all — hide the menu entirely (self-hosted path).
  if (!supabase) return null;
  if (loading) return null;

  if (!user) {
    return <SignInButton compact={compact} />;
  }

  const name =
    (user.user_metadata?.name as string | undefined) ||
    (user.user_metadata?.user_name as string | undefined) ||
    user.email?.split("@")[0] ||
    "You";
  const avatar = user.user_metadata?.avatar_url as string | undefined;

  return (
    <div className="relative" style={{ fontFamily: "var(--font-sans)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group inline-flex items-center gap-2 h-8 pl-0.5 pr-2.5 rounded-full bg-surface shadow-card hover:shadow-card-hover transition-[transform,box-shadow] duration-200 ease-out active:scale-[0.96]"
      >
        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-accent-dim text-accent overflow-hidden shrink-0">
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatar} alt="" width={28} height={28} className="w-full h-full object-cover" />
          ) : (
            <span className="text-[12px] font-semibold">
              {name[0]?.toUpperCase() ?? "?"}
            </span>
          )}
        </span>
        {!compact && (
          <span className="text-[12.5px] text-heading truncate max-w-[10ch]">
            {name}
          </span>
        )}
        <svg
          width="10"
          height="10"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`text-text-faint transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[180px] rounded-xl bg-surface shadow-card-hover overflow-hidden animate-fade-in-up">
            <div className="px-3 py-2.5 border-b border-border/70">
              <div className="text-[12.5px] text-heading font-medium truncate">
                {name}
              </div>
              {user.email && (
                <div className="text-[11px] text-text-faint truncate">
                  {user.email}
                </div>
              )}
            </div>
            <form method="POST" action="/auth/signout">
              <button
                type="submit"
                className="w-full text-left px-3 py-2 text-[12.5px] text-text-muted hover:text-red hover:bg-red/5 transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </>
      )}
    </div>
  );
}

function SignInButton({ compact }: { compact: boolean }) {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    if (!supabase) return;
    setBusy(true);
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: { redirectTo: `${origin}/auth/callback` },
    });
    // OAuth redirects away — no need to unset busy.
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-heading text-bg hover:bg-heading/90 transition-all duration-200 ease-out active:scale-[0.96] disabled:opacity-60 text-[12.5px] font-medium shadow-card"
      style={{ fontFamily: "var(--font-sans)" }}
      aria-label="Sign in with GitHub"
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M12 .5C5.73.5.75 5.48.75 11.75a11.25 11.25 0 0 0 7.69 10.69c.56.1.76-.24.76-.54v-2.1c-3.13.68-3.79-1.34-3.79-1.34-.51-1.31-1.26-1.66-1.26-1.66-1.03-.7.08-.69.08-.69 1.14.08 1.74 1.17 1.74 1.17 1.01 1.74 2.66 1.23 3.31.94.1-.73.4-1.23.72-1.51-2.5-.29-5.13-1.25-5.13-5.56 0-1.23.44-2.24 1.16-3.03-.12-.28-.5-1.43.11-2.98 0 0 .95-.3 3.12 1.16a10.75 10.75 0 0 1 5.68 0c2.17-1.46 3.12-1.16 3.12-1.16.61 1.55.23 2.7.11 2.98.73.79 1.16 1.8 1.16 3.03 0 4.33-2.63 5.26-5.14 5.55.41.35.78 1.04.78 2.1v3.11c0 .3.2.65.77.54A11.26 11.26 0 0 0 23.25 11.75C23.25 5.48 18.27.5 12 .5z" />
      </svg>
      {compact ? "Sign in" : "Sign in with GitHub"}
    </button>
  );
}
