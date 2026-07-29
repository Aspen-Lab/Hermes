"use client";

import { useState } from "react";
import { TopicsField } from "./field-kit";
import { surfaceTopicStatus } from "@/lib/profile/surface-topic-status";

export type TopicSurface = "papers" | "events" | "jobs";

const SURFACE_LABELS: Record<TopicSurface, string> = {
  papers: "Papers",
  events: "Events",
  jobs: "Jobs",
};

export function SurfaceTopicsPanel({
  surface,
  activeRequired,
  activeExplore,
  required,
  explore,
  onChangeRequired,
  onChangeExplore,
  defaultExpanded,
}: {
  surface: TopicSurface;
  activeRequired: string[];
  activeExplore: string[];
  required: string[];
  explore: string[];
  onChangeRequired: (topics: string[]) => void;
  onChangeExplore: (topics: string[]) => void;
  defaultExpanded: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const label = SURFACE_LABELS[surface];
  const status = surfaceTopicStatus(
    { required: activeRequired, explore: activeExplore },
    { required, explore },
  );

  return (
    <section className="mt-3 overflow-hidden rounded-2xl bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        aria-expanded={expanded}
        className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-bg-secondary/35"
      >
        <span>
          <span className="block text-meta font-semibold text-heading">
            {label} topics
          </span>
          <span className="mt-0.5 block text-micro text-text-faint">
            Required / Explore
          </span>
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          className={`shrink-0 text-text-faint transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {status.differs && (
        <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 border-t border-border/50 px-4 py-3 text-micro leading-relaxed">
          <span className="font-semibold text-text-muted">Active now</span>
          <span className="min-w-0 text-text-faint">
            {status.activeSummary}
          </span>
          <span className="font-semibold text-accent">Pending tomorrow</span>
          <span className="min-w-0 text-text-muted">
            {status.pendingSummary}
          </span>
        </div>
      )}

      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3">
          <TopicsField
            required={required}
            soft={explore}
            onChangeRequired={onChangeRequired}
            onChangeSoft={onChangeExplore}
          />
        </div>
      )}

      <p className="border-t border-border/50 px-4 py-2.5 text-micro text-text-faint">
        Changes take effect in tomorrow&apos;s search.
      </p>
    </section>
  );
}
