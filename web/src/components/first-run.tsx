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
import { useProfileStore, useProfileHydrated } from "@/store/profile";
import {
  isLocalProfileRestoreReady,
  subscribeLocalProfileRestore,
} from "@/lib/local-profile-restore";

// True once <LocalProfileSync/>'s dev-only disk-restore attempt has settled
// (or immediately true outside development, where it never runs at all).
// Without this, a returning user with empty localStorage but a valid disk
// snapshot (fresh port, different browser) would get bounced to /welcome by
// the redirect below before the async disk read resolves.
function useLocalProfileRestoreReady(): boolean {
  return useSyncExternalStore(
    subscribeLocalProfileRestore,
    isLocalProfileRestoreReady,
    isLocalProfileRestoreReady,
  );
}

export function FirstRunGate() {
  const router = useRouter();
  const pathname = usePathname();
  const onboardedAt = useProfileStore((s) => s.profile.onboardedAt);
  const hydrated = useProfileHydrated();
  const localRestoreReady = useLocalProfileRestoreReady();

  useEffect(() => {
    // Redirect only once we know the real onboardedAt — never on the stale
    // pre-hydration default, which used to bounce every full page load to
    // /welcome — and only once a possible local-disk restore has settled.
    if (!hydrated || !localRestoreReady) return;
    if (!pathname) return;
    if (pathname === "/welcome" || pathname.startsWith("/auth")) return;
    if (onboardedAt) return;
    router.replace("/welcome");
  }, [hydrated, localRestoreReady, pathname, onboardedAt, router]);

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
