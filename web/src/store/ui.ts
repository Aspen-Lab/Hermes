"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * How report/briefing text reveals itself as it arrives.
 *  - "auto": honor the OS "reduce motion" setting — full decode animation when
 *    motion is allowed, a soft fade when it is not.
 *  - "full": always play the decode animation, even if the OS asks for reduced
 *    motion. An explicit, user-set opt-in; never the default.
 */
export type RevealMotionPreference = "auto" | "full";

interface UIState {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  revealMotion: RevealMotionPreference;
  setRevealMotion: (mode: RevealMotionPreference) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      revealMotion: "auto",
      setRevealMotion: (mode) => set({ revealMotion: mode }),
    }),
    // skipHydration: the persisted value is loaded after mount (see
    // <StoreHydrator/>), so the first client render matches the server's
    // default state. Without this, persist rehydrates synchronously before
    // React hydrates and the saved sidebar state mismatches the SSR markup.
    { name: "peer-ui", skipHydration: true },
  ),
);
