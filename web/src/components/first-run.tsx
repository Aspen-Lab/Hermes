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

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useProfileStore } from "@/store/profile";

export function FirstRunGate() {
  const router = useRouter();
  const pathname = usePathname();
  // The profile store persists to localStorage and hydrates synchronously on
  // the client (same as everywhere else the store is read), so by the time this
  // effect runs `onboardedAt` reflects the real value — no hydration guard
  // needed, and no false redirect for a returning user.
  const onboardedAt = useProfileStore((s) => s.profile.onboardedAt);

  useEffect(() => {
    if (!pathname) return;
    if (pathname === "/welcome" || pathname.startsWith("/auth")) return;
    if (onboardedAt) return;
    router.replace("/welcome");
  }, [pathname, onboardedAt, router]);

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
