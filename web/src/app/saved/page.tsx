"use client";

import { useState } from "react";
import type { Event, Job, Paper } from "@/types";
import { useFeedStore } from "@/store/feed";
import { PaperCard } from "@/components/cards/paper-card";
import { EventCard } from "@/components/cards/event-card";
import { JobCard } from "@/components/cards/job-card";
import { SectionHeading, EmptyState } from "@/components/ui";
import { PageContainer } from "@/components/ui/page-container";
import { cn } from "@/lib/cn";

type SavedKind = "all" | "papers" | "events" | "jobs";
type SavedStatus = "todo" | "done";

interface SavedPageViewProps {
  savedPapers: Paper[];
  savedEvents: Event[];
  savedJobs: Job[];
  appliedAt: Record<string, string>;
  registeredAt: Record<string, string>;
  submittedAt: Record<string, string>;
  onJobApplied: (job: Job, applied: boolean) => void;
  onEventRegistered: (event: Event, registered: boolean) => void;
  onEventSubmitted: (event: Event, submitted: boolean) => void;
  initialKind?: SavedKind;
  initialStatus?: SavedStatus;
}

function SegmentButton({
  label,
  count,
  active,
  tone = "default",
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  tone?: "default" | "done";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-full px-3.5 text-meta font-medium",
        "transition-[background-color,color,box-shadow,transform] duration-150 ease-snap active:scale-[0.97]",
        active
          ? tone === "done"
            ? "bg-done-dim text-done shadow-card"
            : "bg-accent-dim text-accent shadow-card"
          : "text-text-muted hover:bg-surface-hover hover:text-heading",
      )}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={cn(
            "min-w-5 rounded-full px-1.5 py-0.5 text-center text-micro",
            active ? "bg-bg/70" : "bg-bg-secondary text-text-faint",
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}

export function SavedPageView({
  savedPapers,
  savedEvents,
  savedJobs,
  appliedAt,
  registeredAt,
  submittedAt,
  onJobApplied,
  onEventRegistered,
  onEventSubmitted,
  initialKind = "all",
  initialStatus = "todo",
}: SavedPageViewProps) {
  const [kind, setKind] = useState<SavedKind>(initialKind);
  const [status, setStatus] = useState<SavedStatus>(initialStatus);
  const total = savedPapers.length + savedEvents.length + savedJobs.length;

  // Papers have no completion action in this phase, so they remain in To-do.
  const visiblePapers =
    status === "todo" && (kind === "all" || kind === "papers")
      ? savedPapers
      : [];
  const visibleEvents =
    kind === "all" || kind === "events"
      ? savedEvents.filter((event) => {
          const done = Boolean(
            registeredAt[event.id] || submittedAt[event.id],
          );
          return status === "done" ? done : !done;
        })
      : [];
  const visibleJobs =
    kind === "all" || kind === "jobs"
      ? savedJobs.filter((job) =>
          status === "done"
            ? Boolean(appliedAt[job.id])
            : !appliedAt[job.id],
        )
      : [];
  const filteredCount =
    visiblePapers.length + visibleEvents.length + visibleJobs.length;

  const kindSegments: { value: SavedKind; label: string; count: number }[] = [
    { value: "all", label: "All", count: total },
    { value: "papers", label: "Papers", count: savedPapers.length },
    { value: "events", label: "Events", count: savedEvents.length },
    { value: "jobs", label: "Jobs", count: savedJobs.length },
  ];

  return (
    <PageContainer width="wideResponsive" className="px-6 py-16 lg:py-20">
      <header className="mb-8">
        <h1 className="text-[34px] font-semibold leading-[1.1] tracking-[-0.02em] text-heading lg:text-[38px]">
          Saved
        </h1>
        <p className="mt-3 text-lead leading-relaxed text-text-muted">
          Bookmarked papers, events, and jobs.
        </p>
      </header>

      {total > 0 && (
        <div className="mb-10 flex flex-col gap-3">
          <div
            className="flex w-fit max-w-full flex-wrap gap-1 rounded-2xl bg-surface p-1 shadow-well"
            aria-label="Saved item type"
          >
            {kindSegments.map((segment) => (
              <SegmentButton
                key={segment.value}
                label={segment.label}
                count={segment.count}
                active={kind === segment.value}
                onClick={() => setKind(segment.value)}
              />
            ))}
          </div>
          <div
            className="flex w-fit gap-1 rounded-2xl bg-surface p-1 shadow-well"
            aria-label="Completion status"
          >
            <SegmentButton
              label="To-do"
              active={status === "todo"}
              onClick={() => setStatus("todo")}
            />
            <SegmentButton
              label="Done"
              active={status === "done"}
              tone="done"
              onClick={() => setStatus("done")}
            />
          </div>
        </div>
      )}

      {total === 0 && (
        <EmptyState
          title="Nothing saved yet."
          description="Tap the bookmark on anything from your briefing and it will land here — your own reading shelf."
        />
      )}

      {total > 0 && filteredCount === 0 && (
        <EmptyState
          title={`Nothing ${status === "done" ? "done" : "to do"} here.`}
          description="Choose another item type or completion state."
        />
      )}

      {visiblePapers.length > 0 && (
        <>
          <SectionHeading count={visiblePapers.length}>Papers</SectionHeading>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {visiblePapers.map((paper) => (
              <PaperCard key={paper.id} paper={paper} />
            ))}
          </div>
        </>
      )}

      {visibleEvents.length > 0 && (
        <>
          <SectionHeading count={visibleEvents.length}>Events</SectionHeading>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                completion={{
                  registered: Boolean(registeredAt[event.id]),
                  submitted: Boolean(submittedAt[event.id]),
                  onRegisteredChange: (next) =>
                    onEventRegistered(event, next),
                  onSubmittedChange: (next) =>
                    onEventSubmitted(event, next),
                }}
              />
            ))}
          </div>
        </>
      )}

      {visibleJobs.length > 0 && (
        <>
          <SectionHeading count={visibleJobs.length}>Jobs</SectionHeading>
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {visibleJobs.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                completion={{
                  applied: Boolean(appliedAt[job.id]),
                  onChange: (next) => onJobApplied(job, next),
                }}
              />
            ))}
          </div>
        </>
      )}
    </PageContainer>
  );
}

export default function SavedPage() {
  const savedPapers = useFeedStore((state) => state.savedPapers);
  const savedEvents = useFeedStore((state) => state.savedEvents);
  const savedJobs = useFeedStore((state) => state.savedJobs);
  const appliedAt = useFeedStore((state) => state.appliedAt);
  const registeredAt = useFeedStore((state) => state.registeredAt);
  const submittedAt = useFeedStore((state) => state.submittedAt);
  const setJobApplied = useFeedStore((state) => state.setJobApplied);
  const setEventRegistered = useFeedStore(
    (state) => state.setEventRegistered,
  );
  const setEventSubmitted = useFeedStore((state) => state.setEventSubmitted);

  return (
    <SavedPageView
      savedPapers={savedPapers}
      savedEvents={savedEvents}
      savedJobs={savedJobs}
      appliedAt={appliedAt}
      registeredAt={registeredAt}
      submittedAt={submittedAt}
      onJobApplied={setJobApplied}
      onEventRegistered={setEventRegistered}
      onEventSubmitted={setEventSubmitted}
    />
  );
}
