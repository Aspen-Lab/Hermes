"use client";

// Bridges the local zustand profile store to a dev-only JSON snapshot on
// disk (/api/local-profile), so onboarding survives a "fresh" browser
// origin — a new dev-server port, a different browser, an incognito
// window, or localStorage getting cleared — without needing a Supabase
// account. Complements (does not replace) the existing localStorage
// persistence in store/profile.ts.
//
//   • Once the store hydrates, if there's no onboarded profile yet, fetch
//     the last disk snapshot and restore it before <FirstRunGate/> can
//     redirect to /welcome (see lib/local-profile-restore.ts for how that
//     race is avoided).
//   • On every change to an onboarded profile, debounced-write the current
//     profile back to disk.
//
// Entirely inert outside `next dev` — process.env.NODE_ENV is inlined at
// build time, so the fetch calls below are dead code in production bundles.

import { useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { markLocalProfileRestoreReady } from "@/lib/local-profile-restore";
import { useProfileStore, useProfileHydrated } from "@/store/profile";
import type { UserProfile } from "@/types";

const DEBOUNCE_MS = 700;
const IS_DEV = process.env.NODE_ENV === "development";

export function LocalProfileSync() {
  const profile = useProfileStore((s) => s.profile);
  const loadFromLocalSnapshot = useProfileStore((s) => s.loadFromLocalSnapshot);
  const hydrated = useProfileHydrated();
  const restoreAttemptedRef = useRef(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // 1. Try a disk restore exactly once, only after real localStorage
  //    hydration has landed (skipHydration means the pre-hydration default
  //    would otherwise look indistinguishable from "genuinely empty") and
  //    only if it came up with no onboarded profile.
  useEffect(() => {
    if (!IS_DEV || !hydrated || restoreAttemptedRef.current) return;
    restoreAttemptedRef.current = true;

    if (useProfileStore.getState().profile.onboardedAt) {
      // Already onboarded from localStorage — no need to touch disk.
      markLocalProfileRestoreReady();
      return;
    }

    apiFetch<{ profile: UserProfile | null }>("/api/local-profile", {
      cache: "no-store",
    })
      .then(({ profile: snapshot }) => {
        if (snapshot?.onboardedAt) loadFromLocalSnapshot(snapshot);
      })
      .catch((err) => console.warn("[LocalProfileSync] restore failed", err))
      .finally(markLocalProfileRestoreReady);
  }, [hydrated, loadFromLocalSnapshot]);

  // 2. Mirror every change to an onboarded profile back to disk, debounced.
  useEffect(() => {
    if (!IS_DEV || !hydrated || !profile.onboardedAt) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      apiFetch("/api/local-profile", {
        method: "PUT",
        body: JSON.stringify(profile),
        cache: "no-store",
      }).catch((err) => console.warn("[LocalProfileSync] save failed", err));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [profile, hydrated]);

  return null;
}
