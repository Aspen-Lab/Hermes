import type { ReactNode } from "react";
import Link from "next/link";
import type {
  ActivityCounts,
  AggregatedActivityDay,
  SavedActivityItem,
} from "@/lib/dashboard/activity-ledger";

function dateLabel(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function percent(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 100);
}

function topicKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function uniqueTopics(topics: string[]): string[] {
  const unique = new Map<string, string>();
  for (const raw of topics) {
    const label = raw.trim();
    const key = topicKey(label);
    if (key && !unique.has(key)) unique.set(key, label);
  }
  return [...unique.values()];
}

function CountTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div
      className="rounded-2xl bg-surface p-5 shadow-card"
      data-dashboard-count={label.toLocaleLowerCase().replace(/\s+/g, "-")}
    >
      <p className={`text-[30px] font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="mt-1 text-meta text-text-muted">{label}</p>
    </div>
  );
}

function HoldingRow({
  label,
  done,
  total,
  action,
}: {
  label: string;
  done: number;
  total: number;
  action: string;
}) {
  const progress = percent(done, total);
  return (
    <div data-holding-kind={label.toLocaleLowerCase()}>
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-body font-medium text-heading">{label}</p>
        <p className="text-meta tabular-nums text-text-muted">
          <span className="font-semibold text-done">{done}</span> / {total}{" "}
          {action}
        </p>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-bg-secondary"
        role="progressbar"
        aria-label={`${label}: ${done} of ${total} ${action}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress}
      >
        <span
          className="block h-full rounded-full bg-done"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

function ActivityChart({ days }: { days: AggregatedActivityDay[] }) {
  const maxItems = Math.max(
    1,
    ...days.map(
      ({ counts }) => counts.papers + counts.events + counts.jobs,
    ),
  );

  return (
    <section className="rounded-3xl bg-surface p-6 shadow-card lg:col-span-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-micro font-semibold uppercase tracking-[0.18em] text-text-faint">
            Rhythm
          </p>
          <h2 className="mt-1 text-title font-semibold text-heading">
            Last 14 days
          </h2>
        </div>
        <div className="flex flex-wrap gap-3 text-caption text-text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden />
            Papers
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-tag" aria-hidden />
            Events
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-link" aria-hidden />
            Jobs
          </span>
        </div>
      </div>

      <div className="mt-6 grid h-40 grid-cols-[repeat(14,minmax(0,1fr))] items-end gap-1.5">
        {days.map(({ date, counts }) => {
          const total = counts.papers + counts.events + counts.jobs;
          return (
            <div
              key={date}
              className="flex h-full min-w-0 flex-col justify-end"
              data-chart-day={date}
              aria-label={`${date}: ${counts.papers} papers, ${counts.events} events, ${counts.jobs} jobs`}
            >
              <div className="flex h-[124px] flex-col justify-end overflow-hidden rounded-t-md bg-bg-secondary/55">
                <span
                  className="block shrink-0 bg-link"
                  style={{ height: `${(counts.jobs / maxItems) * 100}%` }}
                  aria-hidden
                />
                <span
                  className="block shrink-0 bg-tag"
                  style={{ height: `${(counts.events / maxItems) * 100}%` }}
                  aria-hidden
                />
                <span
                  className="block shrink-0 bg-accent"
                  style={{ height: `${(counts.papers / maxItems) * 100}%` }}
                  aria-hidden
                />
              </div>
              <span
                className={`mt-2 truncate text-center text-[9px] tabular-nums ${
                  total > 0 ? "text-text-muted" : "text-text-faint"
                }`}
              >
                {dateLabel(date)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function DashboardOverview({
  today,
  days,
  savedItems,
  requiredTopics,
  requiredTopicHits,
  children,
}: {
  today: ActivityCounts;
  days: AggregatedActivityDay[];
  savedItems: SavedActivityItem[];
  requiredTopics: string[];
  requiredTopicHits: Record<string, number>;
  children?: ReactNode;
}) {
  const papers = savedItems.filter(({ kind }) => kind === "paper");
  const events = savedItems.filter(({ kind }) => kind === "event");
  const jobs = savedItems.filter(({ kind }) => kind === "job");
  const readPapers = papers.filter(({ read }) => read).length;
  const completedEvents = events.filter(
    ({ registeredAt, submittedAt }) => registeredAt || submittedAt,
  ).length;
  const appliedJobs = jobs.filter(({ appliedAt }) => appliedAt).length;
  const topics = uniqueTopics(requiredTopics);
  const topicHitsByKey = new Map(
    Object.entries(requiredTopicHits).map(([topic, hits]) => [
      topicKey(topic),
      hits,
    ]),
  );

  return (
    <section
      className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-2"
      data-dashboard-overview
    >
      <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-4">
        <CountTile label="Papers today" value={today.papers} tone="text-accent" />
        <CountTile label="Events today" value={today.events} tone="text-tag" />
        <CountTile label="Jobs today" value={today.jobs} tone="text-link" />
        <CountTile
          label="You saved"
          value={savedItems.length}
          tone="text-done"
        />
      </div>

      <ActivityChart days={days} />

      <section className="rounded-3xl bg-surface p-6 shadow-card">
        <p className="text-micro font-semibold uppercase tracking-[0.18em] text-text-faint">
          Progress
        </p>
        <h2 className="mt-1 text-title font-semibold text-heading">
          What you&apos;re holding
        </h2>
        <div className="mt-6 space-y-5">
          <HoldingRow
            label="Papers"
            done={readPapers}
            total={papers.length}
            action="read"
          />
          <HoldingRow
            label="Events"
            done={completedEvents}
            total={events.length}
            action="registered or submitted"
          />
          <HoldingRow
            label="Jobs"
            done={appliedJobs}
            total={jobs.length}
            action="applied"
          />
        </div>
      </section>

      <section className="rounded-3xl bg-surface p-6 shadow-card">
        <p className="text-micro font-semibold uppercase tracking-[0.18em] text-text-faint">
          Coverage
        </p>
        <h2 className="mt-1 text-title font-semibold text-heading">
          Required topics
        </h2>
        {topics.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {topics.map((topic) => {
              const hits = topicHitsByKey.get(topicKey(topic)) ?? 0;
              return (
                <span
                  key={topicKey(topic)}
                  className={
                    hits > 0
                      ? "inline-flex items-center gap-2 rounded-full bg-accent-dim px-3 py-2 text-meta text-accent"
                      : "inline-flex items-center gap-2 rounded-full bg-bg-secondary px-3 py-2 text-meta text-text-faint"
                  }
                  data-topic-coverage={topic}
                >
                  <span>{topic}</span>
                  <span className="tabular-nums">{hits}</span>
                </span>
              );
            })}
          </div>
        ) : (
          <p className="mt-5 text-body-sm leading-6 text-text-muted">
            Add required topics in{" "}
            <Link href="/profile" className="text-link underline underline-offset-4">
              Profile
            </Link>{" "}
            to track daily coverage.
          </p>
        )}
      </section>

      {children && <div className="lg:col-span-2">{children}</div>}
    </section>
  );
}
