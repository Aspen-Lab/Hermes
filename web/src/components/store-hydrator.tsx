"use client";

import { useEffect } from "react";
import { useProfileStore } from "@/store/profile";
import { useFeedStore } from "@/store/feed";
import { useUIStore } from "@/store/ui";

// All three zustand stores use `persist({ skipHydration: true })` so they do
// NOT auto-load localStorage before React hydrates. That keeps the first
// client render identical to the server render (which never sees localStorage),
// avoiding hydration mismatches. We then load the persisted state here, in an
// effect that runs after hydration, which triggers a re-render with the
// saved values. Mount once near the root (in layout.tsx).
export function StoreHydrator() {
  useEffect(() => {
    useProfileStore.persist.rehydrate();
    useFeedStore.persist.rehydrate();
    useUIStore.persist.rehydrate();
  }, []);

  return null;
}
