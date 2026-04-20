"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeedStore } from "@/store/feed";

const tabs = [
  { href: "/", label: "Feed" },
  { href: "/saved", label: "Saved" },
  { href: "/profile", label: "Profile" },
];

export function Nav() {
  const pathname = usePathname();
  const savedCount =
    useFeedStore((s) => s.savedPapers.length) +
    useFeedStore((s) => s.savedEvents.length) +
    useFeedStore((s) => s.savedJobs.length);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Mobile: top bar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-bg-secondary/90 backdrop-blur-md lg:hidden">
        <div className="h-12 px-6 flex items-center justify-between">
          <Link href="/" className="font-mono text-sm font-semibold text-accent tracking-tight">
            Hermes
          </Link>
          <div className="flex items-center gap-6">
            {tabs.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`font-mono text-[13px] transition-colors ${
                  isActive(href) ? "text-text" : "text-text-faint hover:text-text-muted"
                }`}
              >
                {label}
                {label === "Saved" && savedCount > 0 && (
                  <span className="ml-1.5 text-accent text-[11px]">{savedCount}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Desktop: sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-52 z-50 border-r border-border bg-bg-secondary/70 backdrop-blur-md flex-col">
        <div className="px-5 pt-8 pb-10">
          <Link href="/" className="font-mono text-base font-bold text-accent tracking-tight">
            hermes
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {tabs.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-between px-4 py-2.5 rounded-lg font-mono text-[13px] transition-colors ${
                isActive(href)
                  ? "text-heading bg-surface"
                  : "text-text-faint hover:text-text-muted hover:bg-surface/40"
              }`}
            >
              <span>{label}</span>
              {label === "Saved" && savedCount > 0 && (
                <span className="text-accent text-[12px]">{savedCount}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="px-5 py-5 border-t border-border">
          <span className="font-mono text-[11px] text-text-faint/60">v0.1.0</span>
        </div>
      </aside>
    </>
  );
}
