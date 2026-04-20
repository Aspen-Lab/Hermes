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
    <article className="mx-auto max-w-[720px] lg:max-w-[960px] px-6 py-12">
      <header className="mb-2">
        <h1 className="text-3xl font-bold text-heading tracking-tight">Saved</h1>
        <p className="text-text-muted mt-2 text-[15px]">
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
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {savedPapers.map((p) => <PaperCard key={p.id} paper={p} />)}
              </div>
            </>
          )}
          {savedEvents.length > 0 && (
            <>
              <SectionHeading count={savedEvents.length}>Events</SectionHeading>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {savedEvents.map((e) => <EventCard key={e.id} event={e} />)}
              </div>
            </>
          )}
          {savedJobs.length > 0 && (
            <>
              <SectionHeading count={savedJobs.length}>Jobs</SectionHeading>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {savedJobs.map((j) => <JobCard key={j.id} job={j} />)}
              </div>
            </>
          )}
        </>
      )}
    </article>
  );
}
