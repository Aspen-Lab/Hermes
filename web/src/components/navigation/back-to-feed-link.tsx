"use client";

import type { ComponentProps } from "react";
import Link from "next/link";
import { hasImmediateFeedHistoryEntry } from "@/lib/navigation/feed-history";

type BackToFeedLinkProps = Omit<
  ComponentProps<typeof Link>,
  "href" | "onNavigate"
> & {
  onBack?: () => void;
};

export function BackToFeedLink({ children, onBack, ...props }: BackToFeedLinkProps) {
  return (
    <Link
      {...props}
      href="/"
      onNavigate={(event) => {
        if (!onBack || !hasImmediateFeedHistoryEntry(window)) return;
        event.preventDefault();
        onBack();
      }}
    >
      {children}
    </Link>
  );
}
