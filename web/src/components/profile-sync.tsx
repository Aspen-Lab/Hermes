"use client";

// Bridges the local zustand profile store to the Supabase `profiles` table.
//
//   signed-out  — localStorage only (unchanged)
//   signed-in   — on login: pull server → if server empty, push local up
//                 on update: debounced PUT to /api/profile
//
// Mount once, near the root, alongside <UserMenu />.

import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase/client";
import { useProfileStore } from "@/store/profile";
import type { UserProfile } from "@/types";

const DEBOUNCE_MS = 700;

function hasAnySignal(p: UserProfile): boolean {
  return (
    p.researchTopics.length > 0 ||
    p.preferredMethods.length > 0 ||
    p.preferredVenues.length > 0 ||
    p.locationPreferences.length > 0
  );
}

async function fetchRemote(): Promise<Partial<UserProfile> | null> {
  try {
    const res = await fetch("/api/profile", { cache: "no-store" });
    console.info("[ProfileSync] GET /api/profile", res.status);
    if (!res.ok) return null;
    const data = (await res.json()) as { profile: Partial<UserProfile> | null };
    return data.profile;
  } catch (err) {
    console.warn("[ProfileSync] GET failed", err);
    return null;
  }
}

async function pushRemote(p: UserProfile): Promise<void> {
  try {
    const res = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(p),
      cache: "no-store",
    });
    const body = await res.json().catch(() => null);
    console.info("[ProfileSync] PUT /api/profile", res.status, body);
  } catch (err) {
    console.warn("[ProfileSync] PUT failed", err);
  }
}

export function ProfileSync() {
  const profile = useProfileStore((s) => s.profile);
  const hydrateFromRemote = useProfileStore((s) => s.hydrateFromRemote);
  const isSignedInRef = useRef(false);
  const didInitialPullRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  // 1. React to auth changes — pull on sign-in, reset state on sign-out.
  useEffect(() => {
    if (!supabase) return;

    const onSession = async (signedIn: boolean) => {
      console.info("[ProfileSync] auth state:", signedIn ? "signed-in" : "signed-out");
      isSignedInRef.current = signedIn;
      if (!signedIn) {
        didInitialPullRef.current = false;
        return;
      }
      if (didInitialPullRef.current) return;
      didInitialPullRef.current = true;

      const remote = await fetchRemote();
      const local = useProfileStore.getState().profile;

      // Server empty? Push local up so the first device keeps its signals.
      if (!remote || !hasAnySignal({ ...local, ...remote } as UserProfile)) {
        if (hasAnySignal(local)) pushRemote(local);
        return;
      }

      // Server has data — hydrate local with it (server wins).
      hydrateFromRemote(remote);
    };

    supabase.auth.getUser().then(({ data }) => onSession(!!data.user));

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") onSession(false);
      else if (session?.user) onSession(true);
    });

    return () => sub.subscription.unsubscribe();
  }, [hydrateFromRemote]);

  // 2. Push local changes to server, debounced. Only when signed in and after
  //    the initial pull has completed.
  useEffect(() => {
    if (!isSignedInRef.current || !didInitialPullRef.current) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => pushRemote(profile), DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [profile]);

  return null;
}
