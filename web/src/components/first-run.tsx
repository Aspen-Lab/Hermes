"use client";

// First-run onboarding plumbing:
//   • FirstRunGate          — redirects a user who has never completed the
//                             welcome wizard to /welcome (once the persisted
//                             profile has hydrated, to avoid a false redirect).
//   • DesktopAccountControls — the floating account + GitHub-star cluster,
//                             hidden on /welcome so the wizard reads clean.
//
// Onboarding state is local (see UserProfile.onboardedAt), so this works for
// signed-out visitors too and resets cleanly when localStorage is cleared.

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfileStore } from "@/store/profile";

// True once the profile store has rehydrated from localStorage. The store uses
// `skipHydration` and is rehydrated after mount by <StoreHydrator/>, so before
// that finishes `onboardedAt` reads as its default (null) even for a returning
// user. useSyncExternalStore gives a prerender-safe read: the server snapshot
// is always false, and the client re-reads when hydration finishes.
function useProfileHydrated(): boolean {
  return useSyncExternalStore(
    (onChange) => useProfileStore.persist.onFinishHydration(onChange),
    () => useProfileStore.persist.hasHydrated(),
    () => false,
  );
}

export function FirstRunGate() {
  const router = useRouter();
  const pathname = usePathname();
  const onboardedAt = useProfileStore((s) => s.profile.onboardedAt);
  const hydrated = useProfileHydrated();

  useEffect(() => {
    // Redirect only once we know the real onboardedAt — never on the stale
    // pre-hydration default, which used to bounce every full page load to
    // /welcome.
    if (!hydrated) return;
    if (!pathname) return;
    if (pathname === "/welcome" || pathname.startsWith("/auth")) return;
    if (onboardedAt) return;
    router.replace("/welcome");
  }, [hydrated, pathname, onboardedAt, router]);

  return null;
}

// Positions the floating account controls and hides them on /welcome. The
// controls themselves are passed in as `children` from the server layout, so
// async Server Components (e.g. GithubStars) stay server-rendered rather than
// being pulled into this client module.
export function DesktopAccountControls({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/welcome") return null;
  return (
    <div className="fixed top-4 right-5 z-[55] hidden lg:flex items-center gap-2">
      {children}
    </div>
  );
}
