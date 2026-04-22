"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useFeedStore } from "@/store/feed";
import { useUIStore } from "@/store/ui";
import { UserMenu } from "@/components/user-menu";

type Tab = {
  href: string;
  label: string;
  shortcut: string;
};

function IconFeed({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 4.5A1.5 1.5 0 0 1 3.5 3h17A1.5 1.5 0 0 1 22 4.5V19a2 2 0 0 1-2 2H5.5A3.5 3.5 0 0 1 2 17.5z" />
      <path d="M6 8h12M6 12h12M6 16h7" />
    </svg>
  );
}

function IconSaved({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill={active ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconProfile({ active = false }: { active?: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? 2 : 1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

const tabs: Tab[] = [
  { href: "/", label: "Feed", shortcut: "g h" },
  { href: "/saved", label: "Saved", shortcut: "g s" },
  { href: "/profile", label: "Profile", shortcut: "g p" },
];

function iconFor(href: string, active: boolean): React.ReactNode {
  if (href === "/") return <IconFeed active={active} />;
  if (href === "/saved") return <IconSaved active={active} />;
  return <IconProfile active={active} />;
}

function formatSynced(lastRefresh: string | null): string {
  if (!lastRefresh) return "not synced";
  const diff = Date.now() - new Date(lastRefresh).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function Nav() {
  const pathname = usePathname();
  const sidebarOpen = useUIStore((s) => s.sidebarOpen);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const setSidebarOpen = useUIStore((s) => s.setSidebarOpen);

  // Sync CSS variable so <main> padding transitions in lockstep with the
  // sidebar slide. Done in effect so SSR defaults to the CSS fallback.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--sidebar-offset",
      sidebarOpen ? "13rem" : "0px",
    );
  }, [sidebarOpen]);

  const savedCount =
    useFeedStore((s) => s.savedPapers.length) +
    useFeedStore((s) => s.savedEvents.length) +
    useFeedStore((s) => s.savedJobs.length);

  const papers = useFeedStore((s) => s.papers);
  const events = useFeedStore((s) => s.events);
  const jobs = useFeedStore((s) => s.jobs);
  const readItems = useFeedStore((s) => s.readItems);
  const lastRefresh = useFeedStore((s) => s.lastRefresh);

  const unreadCount =
    papers.filter((p) => !readItems[p.id]).length +
    events.filter((e) => !readItems[e.id]).length +
    jobs.filter((j) => !readItems[j.id]).length;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const countFor = (href: string): number => {
    if (href === "/") return unreadCount;
    if (href === "/saved") return savedCount;
    return 0;
  };

  const openHelp = () => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("hermes:toggle-help"));
    }
  };

  return (
    <>
      {/* Mobile: top bar */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-bg-secondary/85 backdrop-blur-md lg:hidden">
        <div className="h-14 px-6 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-[20px] font-normal text-heading tracking-[-0.01em] italic"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <img src="/logo.svg" alt="" width={32} height={32} className="shrink-0" />
            Hermes
          </Link>
          <div
            className="flex items-center gap-5"
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {tabs.map(({ href, label }) => {
              const n = countFor(href);
              return (
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
                  {n > 0 && (
                    <span className="ml-1.5 text-[11px] tabular-nums text-accent">
                      {n}
                    </span>
                  )}
                </Link>
              );
            })}
            <UserMenu compact />
          </div>
        </div>
      </nav>

      {/* Desktop: sidebar — translates off-screen when collapsed. */}
      <aside
        className={`hidden lg:flex fixed inset-y-0 left-0 w-52 z-50 border-r border-border bg-bg-secondary/60 backdrop-blur-md flex-col transition-transform duration-[350ms] ease-[cubic-bezier(0.4,0,0.2,1)] will-change-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-hidden={!sidebarOpen}
      >
        <div className="relative px-6 pt-10 pb-10">
          <Link
            href="/"
            className="flex items-center gap-3 text-[28px] font-normal text-heading tracking-[-0.02em] italic leading-none"
            style={{ fontFamily: "var(--font-display)" }}
          >
            <img src="/logo.svg" alt="" width={60} height={60} className="shrink-0" />
            Hermes
          </Link>

          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            title="Collapse sidebar (\)"
            aria-label="Collapse sidebar"
            className="absolute top-4 right-3 inline-flex items-center justify-center w-7 h-7 rounded-full text-text-faint hover:text-heading hover:bg-surface transition-colors active:scale-[0.92]"
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M15 18l-6-6 6-6" />
              <path d="M20 4v16" />
            </svg>
          </button>
        </div>

        <nav
          className="flex-1 px-3 space-y-0.5"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {tabs.map(({ href, label, shortcut }) => {
            const active = isActive(href);
            const n = countFor(href);
            return (
              <Link
                key={href}
                href={href}
                tabIndex={sidebarOpen ? 0 : -1}
                className={`group flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-[13.5px] transition-all duration-200 ease-out active:scale-[0.98] ${
                  active
                    ? "text-heading bg-surface shadow-card"
                    : "text-text-faint hover:text-heading hover:bg-surface/50"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`inline-flex items-center justify-center w-4 h-4 shrink-0 transition-colors ${
                      active ? "text-accent" : "text-text-faint group-hover:text-text-muted"
                    }`}
                  >
                    {iconFor(href, active)}
                  </span>
                  <span className="truncate">{label}</span>
                  {n > 0 && (
                    <span className="inline-flex items-center gap-1 text-accent text-[11.5px] tabular-nums">
                      {href === "/" && (
                        <span
                          className="block w-[5px] h-[5px] rounded-full bg-accent"
                          aria-hidden
                        />
                      )}
                      {n}
                    </span>
                  )}
                </span>
                <NavShortcut value={shortcut} dimmed={!active} />
              </Link>
            );
          })}
        </nav>

        {/* ── Status + shortcuts footer ── */}
        <div
          className="px-4 py-4 border-t border-border flex flex-col gap-3"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          <UserMenu />

          <div className="flex items-center gap-2 text-[11px] text-text-faint">
            <span
              className={`block w-[6px] h-[6px] rounded-full shrink-0 ${
                lastRefresh ? "bg-accent" : "bg-border-strong"
              }`}
              aria-hidden
            />
            <span className="truncate">
              <span className="text-text-muted">Synced </span>
              <span
                className="text-heading tabular-nums font-medium"
                suppressHydrationWarning
              >
                {formatSynced(lastRefresh)}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={openHelp}
              tabIndex={sidebarOpen ? 0 : -1}
              title="Keyboard shortcuts"
              className="group inline-flex items-center gap-1.5 text-[11px] text-text-faint hover:text-heading transition-colors active:scale-[0.95]"
            >
              <NavKbd>?</NavKbd>
              Shortcuts
            </button>
            <span className="text-[10px] text-text-faint/70 tracking-wider uppercase">
              v0.1.0
            </span>
          </div>
        </div>
      </aside>

      {/* Collapsed floating toggle — icon-only. Minimal footprint so the
          reclaimed space actually feels reclaimed. Unread count surfaces as a
          small badge so you don't need to open the sidebar to see it. */}
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Expand sidebar"
        title="Expand sidebar (\)"
        className={`group hidden lg:inline-flex fixed top-4 left-4 z-[55] items-center justify-center w-10 h-10 rounded-full bg-surface/95 backdrop-blur border border-border-strong shadow-card hover:shadow-card-hover hover:-translate-y-[1px] transition-[opacity,transform,box-shadow] duration-[300ms] ease-out active:scale-[0.94] ${
          sidebarOpen
            ? "opacity-0 -translate-x-2 pointer-events-none"
            : "opacity-100 translate-x-0"
        }`}
      >
        <img
          src="/logo.svg"
          alt=""
          width={26}
          height={26}
          className="shrink-0 transition-transform duration-300 ease-out group-hover:scale-[1.06]"
        />

        {/* Expand affordance — appears on hover, nudges to indicate direction */}
        <span
          className="absolute -right-1 -bottom-1 inline-flex items-center justify-center w-4 h-4 rounded-full bg-heading text-bg opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200 ease-out"
          aria-hidden
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18l6-6-6-6" />
          </svg>
        </span>

        {/* Unread badge — hidden when zero or sidebar is open */}
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-bg text-[10.5px] font-semibold tabular-nums shadow-card border border-bg/20 group-hover:opacity-0 transition-opacity duration-200"
            aria-label={`${unreadCount} unread`}
            style={{ fontFamily: "var(--font-sans)" }}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>
    </>
  );
}

function NavShortcut({ value, dimmed }: { value: string; dimmed: boolean }) {
  const parts = value.split(" ");
  return (
    <span
      className={`flex items-center gap-0.5 shrink-0 transition-opacity duration-200 ${
        dimmed ? "opacity-0 group-hover:opacity-70" : "opacity-60"
      }`}
      aria-hidden
    >
      {parts.map((k, i) => (
        <NavKbd key={i}>{k}</NavKbd>
      ))}
    </span>
  );
}

function NavKbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded bg-bg-secondary/80 border border-border-strong text-[9.5px] text-text-muted leading-none"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </kbd>
  );
}
