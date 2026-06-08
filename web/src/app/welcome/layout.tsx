import type { ReactNode } from "react";

// The welcome wizard is a full-screen, standalone experience with no app chrome.
// Rendering it outside <main> (which carries the sidebar padding-left offset)
// ensures it sits flush and centred regardless of the sidebar state.
export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
