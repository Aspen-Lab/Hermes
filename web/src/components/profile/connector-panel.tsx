"use client";

// The "Data APIs" control body: one dropdown to switch between the three
// bring-your-own-key data sources that widen jobs/events coverage, each with
// its own key inputs, a one-line "why it matters", and a registration link.
// All keys live in local browser state (see UserProfile) — never synced to the
// shared profile row.

import { useState } from "react";
import { useProfileStore } from "@/store/profile";
import { SecretInput } from "@/components/ui";
import { buttonVariants } from "@/components/ui/button";

// Small external-link glyph shown inside the "Get a key" button.
function ExternalLinkIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

type Connector = "tavily" | "adzuna" | "usajobs";

const CONNECTORS: { id: Connector; label: string; blurb: string; guide: string; href: string }[] = [
  {
    id: "tavily",
    label: "Tavily",
    blurb:
      "Web discovery for conferences and academic job boards (HigherEdJobs, jobs.ac.uk, Nature Careers). The main source of events + jobs for non-CS fields.",
    guide: "Sign up free (1,000 searches/mo), copy the key from your dashboard.",
    href: "https://tavily.com",
  },
  {
    id: "adzuna",
    label: "Adzuna",
    blurb:
      "Industry job aggregator across 19 countries — the best source of company R&D and lab positions. Free tier is plenty for a daily briefing.",
    guide: "Register a free app at developer.adzuna.com to get an App ID + App Key.",
    href: "https://developer.adzuna.com",
  },
  {
    id: "usajobs",
    label: "USAJobs",
    blurb:
      "Every US federal & national-lab research posting (NIH, NSF, DOE labs). Free, government-run, no rate limits.",
    guide: "Request a key with your email at developer.usajobs.gov (instant).",
    href: "https://developer.usajobs.gov/apirequest/",
  },
];

export function connectedCount(p: {
  tavilyEnabled?: boolean;
  tavilyApiKey?: string;
  adzunaAppId?: string;
  adzunaAppKey?: string;
  usajobsApiKey?: string;
  usajobsUserAgent?: string;
}): number {
  let n = 0;
  if (p.tavilyEnabled && p.tavilyApiKey?.trim()) n++;
  if (p.adzunaAppId?.trim() && p.adzunaAppKey?.trim()) n++;
  if (p.usajobsApiKey?.trim() && p.usajobsUserAgent?.trim()) n++;
  return n;
}

function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-text-faint/40"}`}
      aria-hidden
    />
  );
}

export function ConnectorPanel() {
  const profile = useProfileStore((s) => s.profile);
  const updateTavilyEnabled = useProfileStore((s) => s.updateTavilyEnabled);
  const updateTavilyApiKey = useProfileStore((s) => s.updateTavilyApiKey);
  const updateAdzunaKeys = useProfileStore((s) => s.updateAdzunaKeys);
  const updateUsajobsKeys = useProfileStore((s) => s.updateUsajobsKeys);

  const [active, setActive] = useState<Connector>("tavily");
  const meta = CONNECTORS.find((c) => c.id === active)!;

  const status: Record<Connector, boolean> = {
    tavily: Boolean(profile.tavilyEnabled && profile.tavilyApiKey?.trim()),
    adzuna: Boolean(profile.adzunaAppId?.trim() && profile.adzunaAppKey?.trim()),
    usajobs: Boolean(profile.usajobsApiKey?.trim() && profile.usajobsUserAgent?.trim()),
  };

  return (
    <div
      className="px-3.5 pb-3.5 space-y-3 border-t border-border/50 pt-3"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* Source switcher */}
      <div className="flex items-center gap-1 rounded-lg bg-bg-secondary/45 p-1">
        {CONNECTORS.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActive(c.id)}
            className={`flex-1 inline-flex items-center justify-center gap-1.5 h-7 rounded-md text-[12px] font-medium transition-colors ${
              active === c.id
                ? "bg-surface text-heading shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]"
                : "text-text-muted hover:text-heading"
            }`}
          >
            <StatusDot on={status[c.id]} />
            {c.label}
          </button>
        ))}
      </div>

      <p className="text-[11.5px] leading-relaxed text-text-muted">{meta.blurb}</p>

      {/* Per-source key inputs */}
      {active === "tavily" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11px] text-text-faint">Enable Tavily web scouting</span>
            <button
              type="button"
              role="switch"
              aria-checked={profile.tavilyEnabled}
              onClick={() => updateTavilyEnabled(!profile.tavilyEnabled)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200 ease-out ${
                profile.tavilyEnabled ? "bg-accent" : "bg-bg-secondary"
              }`}
            >
              <span
                className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-bg shadow transition-transform duration-200 ease-out ${
                  profile.tavilyEnabled ? "translate-x-4" : ""
                }`}
              />
            </button>
          </div>
          <SecretInput
            value={profile.tavilyApiKey ?? ""}
            onChange={updateTavilyApiKey}
            placeholder="Tavily API key (tvly-…)"
          />
        </div>
      )}

      {active === "adzuna" && (
        <div className="space-y-2">
          <SecretInput
            value={profile.adzunaAppId ?? ""}
            onChange={(v) => updateAdzunaKeys(v, profile.adzunaAppKey ?? "")}
            placeholder="Adzuna App ID"
          />
          <SecretInput
            value={profile.adzunaAppKey ?? ""}
            onChange={(v) => updateAdzunaKeys(profile.adzunaAppId ?? "", v)}
            placeholder="Adzuna App Key"
          />
        </div>
      )}

      {active === "usajobs" && (
        <div className="space-y-2">
          <SecretInput
            value={profile.usajobsApiKey ?? ""}
            onChange={(v) => updateUsajobsKeys(v, profile.usajobsUserAgent ?? "")}
            placeholder="USAJobs API key"
          />
          <input
            type="email"
            value={profile.usajobsUserAgent ?? ""}
            onChange={(e) => updateUsajobsKeys(profile.usajobsApiKey ?? "", e.target.value)}
            placeholder="Contact email (required by USAJobs)"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg bg-bg-secondary/45 px-3 py-2 text-[12.5px] text-text placeholder:text-text-faint/65 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      )}

      <div className="space-y-2 pt-0.5">
        <p className="text-[10.5px] leading-relaxed text-text-faint">{meta.guide}</p>
        <a
          href={meta.href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${buttonVariants({ tone: "accentSoft", size: "sm" })} w-full`}
        >
          Get a {meta.label} key
          <ExternalLinkIcon />
        </a>
      </div>
    </div>
  );
}
