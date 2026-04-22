"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useFeedStore } from "@/store/feed";
import { useUIStore } from "@/store/ui";

// ── Global keyboard shortcut registry ──

type Shortcut = { keys: string; label: string };

const GROUPS: { title: string; items: Shortcut[] }[] = [
  {
    title: "Anywhere",
    items: [
      { keys: "/", label: "Focus search" },
      { keys: "?", label: "Show this help" },
      { keys: "Esc", label: "Close help / blur search" },
    ],
  },
  {
    title: "Navigate",
    items: [
      { keys: "g h", label: "Go to briefing" },
      { keys: "g s", label: "Go to saved" },
      { keys: "g p", label: "Go to profile" },
    ],
  },
  {
    title: "Briefing",
    items: [
      { keys: "r", label: "Refresh briefing" },
      { keys: "u", label: "Undo last dismiss (within 4s)" },
    ],
  },
  {
    title: "View",
    items: [{ keys: "\\", label: "Toggle sidebar" }],
  },
];

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (el.isContentEditable) return true;
  return false;
}

export function KeyboardLayer() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);
  const [awaitingG, setAwaitingG] = useState(false);
  const loadFeed = useFeedStore((s) => s.loadFeed);
  const undoDismiss = useFeedStore((s) => s.undoDismiss);
  const pendingDismissal = useFeedStore((s) => s.pendingDismissal);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  // Clear pending `g` chord after 1.5s
  useEffect(() => {
    if (!awaitingG) return;
    const t = window.setTimeout(() => setAwaitingG(false), 1500);
    return () => window.clearTimeout(t);
  }, [awaitingG]);

  const handler = useCallback(
    (e: KeyboardEvent) => {
      // Allow Esc globally even when typing
      if (e.key === "Escape") {
        if (helpOpen) {
          setHelpOpen(false);
          e.preventDefault();
          return;
        }
        const active = document.activeElement;
        if (active instanceof HTMLElement && isTypingTarget(active)) {
          active.blur();
          e.preventDefault();
          return;
        }
        return;
      }

      // Don't hijack typing
      if (isTypingTarget(e.target)) return;

      // Ignore modifier combos
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Two-key `g` chord
      if (awaitingG) {
        if (e.key === "h") {
          router.push("/");
          setAwaitingG(false);
          e.preventDefault();
          return;
        }
        if (e.key === "s") {
          router.push("/saved");
          setAwaitingG(false);
          e.preventDefault();
          return;
        }
        if (e.key === "p") {
          router.push("/profile");
          setAwaitingG(false);
          e.preventDefault();
          return;
        }
        setAwaitingG(false);
        return;
      }

      switch (e.key) {
        case "/": {
          const input = document.getElementById(
            "hermes-search",
          ) as HTMLInputElement | null;
          if (input) {
            input.focus();
            input.select();
            e.preventDefault();
          }
          return;
        }
        case "?": {
          setHelpOpen((v) => !v);
          e.preventDefault();
          return;
        }
        case "g": {
          setAwaitingG(true);
          e.preventDefault();
          return;
        }
        case "r": {
          if (window.location.pathname === "/") {
            loadFeed();
            e.preventDefault();
          }
          return;
        }
        case "u": {
          if (pendingDismissal) {
            undoDismiss();
            e.preventDefault();
          }
          return;
        }
        case "\\": {
          toggleSidebar();
          e.preventDefault();
          return;
        }
      }
    },
    [
      awaitingG,
      helpOpen,
      router,
      loadFeed,
      undoDismiss,
      pendingDismissal,
      toggleSidebar,
    ],
  );

  useEffect(() => {
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handler]);

  // External trigger from UI (e.g. sidebar "?" button)
  useEffect(() => {
    const toggle = () => setHelpOpen((v) => !v);
    window.addEventListener("hermes:toggle-help", toggle);
    return () => window.removeEventListener("hermes:toggle-help", toggle);
  }, []);

  return (
    <>
      {awaitingG && <ChordHint />}
      <HelpOverlay open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}

// ── "g … " chord hint ──

function ChordHint() {
  return (
    <div
      className="fixed bottom-6 right-6 z-[65] pointer-events-none animate-fade-in-up"
      style={{ "--i": 0, fontFamily: "var(--font-sans)" } as React.CSSProperties}
    >
      <div className="flex items-center gap-2 bg-heading text-bg rounded-full px-3.5 py-2 text-[12px] shadow-card-hover">
        <Kbd>g</Kbd>
        <span className="text-bg/60">then</span>
        <Kbd>h</Kbd>
        <span className="text-bg/60">·</span>
        <Kbd>s</Kbd>
        <span className="text-bg/60">·</span>
        <Kbd>p</Kbd>
      </div>
    </div>
  );
}

// ── Help overlay ──

function HelpOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      <button
        type="button"
        aria-label="Close help"
        className="absolute inset-0 bg-heading/30 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />

      <div
        className="relative w-full max-w-[440px] rounded-2xl bg-surface shadow-card-hover border border-border-strong p-6 animate-fade-in-up"
        style={{ "--i": 0, fontFamily: "var(--font-sans)" } as React.CSSProperties}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-[13px] font-semibold uppercase tracking-[0.18em] text-text-faint">
            Keyboard shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-text-faint hover:text-heading hover:bg-bg-secondary transition-colors active:scale-[0.92]"
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
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-text-faint/80 mb-2">
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.items.map((s) => (
                  <li
                    key={s.keys}
                    className="flex items-center justify-between gap-4 text-[13.5px]"
                  >
                    <span className="text-text">{s.label}</span>
                    <span className="flex items-center gap-1">
                      {s.keys.split(" ").map((k, i, arr) => (
                        <span key={i} className="flex items-center gap-1">
                          <Kbd>{k}</Kbd>
                          {i < arr.length - 1 && (
                            <span className="text-text-faint text-[11px]">then</span>
                          )}
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-5 pt-4 border-t border-border text-[11.5px] text-text-faint">
          Press <Kbd>?</Kbd> anywhere to open this again.
        </p>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-md bg-bg-secondary border border-border-strong text-[11.5px] text-heading font-medium tabular-nums"
      style={{ fontFamily: "var(--font-mono)" }}
    >
      {children}
    </kbd>
  );
}
