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
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-bg-secondary/85 backdrop-blur-md lg:hidden">
        <div className="h-14 px-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[18px] font-semibold text-heading tracking-[-0.01em] italic"
            style={{ fontFamily: "var(--font-reading)" }}
          >
            <img src="/logo.svg" alt="" width={32} height={32} className="shrink-0" />
            Hermes
          </Link>
          <div
            className="flex items-center gap-5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {tabs.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-[13.5px] transition-all duration-200 ease-out active:scale-95 ${
                  isActive(href)
                    ? "text-heading font-medium"
                    : "text-text-faint hover:text-text-muted"
                }`}
              >
                {label}
                {label === "Saved" && savedCount > 0 && (
                  <span className="ml-1.5 text-accent text-[11px] tabular-nums">{savedCount}</span>
                )}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Desktop: sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-52 z-50 border-r border-border bg-bg-secondary/60 backdrop-blur-md flex-col">
        <div className="px-6 pt-10 pb-12">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[22px] font-semibold text-heading tracking-[-0.015em] italic"
            style={{ fontFamily: "var(--font-reading)" }}
          >
            <img src="/logo.svg" alt="" width={44} height={44} className="shrink-0" />
            Hermes
          </Link>
        </div>

        <nav
          className="flex-1 px-3 space-y-0.5"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {tabs.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center justify-between px-4 py-2 rounded-lg text-[13.5px] transition-all duration-200 ease-out active:scale-[0.98] ${
                isActive(href)
                  ? "text-heading bg-surface shadow-card"
                  : "text-text-faint hover:text-text-muted hover:bg-surface/50"
              }`}
            >
              <span>{label}</span>
              {label === "Saved" && savedCount > 0 && (
                <span className="text-accent text-[11.5px] tabular-nums">{savedCount}</span>
              )}
            </Link>
          ))}
        </nav>

        <div className="px-6 py-5 border-t border-border">
          <span
            className="text-[10.5px] text-text-faint/70 tracking-wider uppercase"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            v0.1.0
          </span>
        </div>
      </aside>
    </>
  );
}
