"use client";

import { useFeedStore } from "@/store/feed";
import { PaperCard } from "@/components/cards/paper-card";
import { EventCard } from "@/components/cards/event-card";
import { JobCard } from "@/components/cards/job-card";
import { SectionHeading, EmptyState } from "@/components/ui";

export default function SavedPage() {
  const savedPapers = useFeedStore((s) => s.savedPapers);
  const savedEvents = useFeedStore((s) => s.savedEvents);
  const savedJobs = useFeedStore((s) => s.savedJobs);
  const isEmpty =
    savedPapers.length === 0 && savedEvents.length === 0 && savedJobs.length === 0;

  return (
    <article className="mx-auto max-w-[740px] lg:max-w-[920px] px-6 py-16 lg:py-20">
      <header className="mb-8">
        <h1
          className="text-[34px] lg:text-[38px] font-semibold text-heading tracking-[-0.02em] leading-[1.1]"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Saved
        </h1>
        <p className="text-text-muted mt-3 text-[16.5px] leading-relaxed">
          Bookmarked papers, events, and jobs.
        </p>
      </header>

      {isEmpty && (
        <EmptyState
          title="Nothing saved yet."
          description="Bookmark items from your daily briefing and they'll appear here."
        />
      )}

      {!isEmpty && (
        <>
          {savedPapers.length > 0 && (
            <>
              <SectionHeading count={savedPapers.length}>Papers</SectionHeading>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {savedPapers.map((p) => <PaperCard key={p.id} paper={p} />)}
              </div>
            </>
          )}
          {savedEvents.length > 0 && (
            <>
              <SectionHeading count={savedEvents.length}>Events</SectionHeading>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {savedEvents.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            </>
          )}
          {savedJobs.length > 0 && (
            <>
              <SectionHeading count={savedJobs.length}>Jobs</SectionHeading>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {savedJobs.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
            </>
          )}
        </>
      )}
    </article>
  );
}
