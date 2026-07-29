import type { Job } from "@/types";
import { formatDayAge } from "@/lib/format";
import { matchQuality } from "@/lib/opportunities/match-quality";
import { jobPrestige } from "@/lib/opportunities/prestige";
import {
  formatSalary,
  SALARY_NOT_DISCLOSED,
} from "@/lib/opportunities/salary";
import { jobUrgency, type UrgencyBucket } from "@/lib/opportunities/urgency";

const DAY_MS = 86_400_000;

const UNKNOWN_URGENCY: UrgencyBucket = {
  text: "text-text-faint",
  bg: "bg-surface/80",
  dot: "bg-text-faint/50",
  label: "Not listed",
};

export type JobCardView = {
  prestige: ReturnType<typeof jobPrestige>;
  employmentTypeLabel: string;
  matchLabel: string;
  matchTone: "accent" | "muted";
  postedLabel: string;
  locationLabel: string;
  locationTone: "neutral" | "accent" | "muted";
  salaryLabel: string;
  salaryTone: "neutral" | "muted";
  urgency: {
    bucket: UrgencyBucket;
    label: string;
  };
  summaryText: string;
  matchedTerms: string[];
};

function titleCase(value: string): string {
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function locationView(job: Job): Pick<JobCardView, "locationLabel" | "locationTone"> {
  const place = job.isRemote ? "Remote" : job.location.trim() || "Location not listed";
  if (job.locationFit === undefined) {
    return { locationLabel: place, locationTone: "neutral" };
  }
  if (job.locationFit >= 0.95) {
    return { locationLabel: `${place} · Preferred`, locationTone: "accent" };
  }
  if (job.locationFit >= 0.8) {
    return { locationLabel: `${place} · Remote-compatible`, locationTone: "accent" };
  }
  return { locationLabel: `${place} · Outside preferences`, locationTone: "muted" };
}

function postingView(job: Job, now: number): Pick<JobCardView, "postedLabel" | "urgency"> {
  const timestamp = job.postedDate ? Date.parse(job.postedDate) : Number.NaN;
  if (!Number.isFinite(timestamp)) {
    return {
      postedLabel: "Posting date not listed",
      urgency: { bucket: UNKNOWN_URGENCY, label: "Posting date not listed" },
    };
  }

  const age = Math.max(0, Math.floor((now - timestamp) / DAY_MS));
  const label =
    age === 0 ? "Posted today" : `Posted ${age} ${age === 1 ? "day" : "days"} ago`;
  return {
    postedLabel: formatDayAge(job.postedDate, now) ?? "Posting date not listed",
    urgency: { bucket: jobUrgency(age), label },
  };
}

export function jobCardView(job: Job, now: number = Date.now()): JobCardView {
  const match = matchQuality(job.relevanceScore);
  const salaryLabel = job.salary
    ? `${formatSalary(job.salary)}${job.salaryIsEstimated ? " · Estimated" : ""}`
    : SALARY_NOT_DISCLOSED;

  return {
    prestige: jobPrestige(job.companyOrLab, job.sourceId, job.summary ?? job.matchReason),
    employmentTypeLabel: job.employmentType?.trim()
      ? titleCase(job.employmentType)
      : "Type not listed",
    matchLabel: match ? `${match.pct}% · ${match.label}` : "Match not scored",
    matchTone: match && match.band !== "marginal" ? "accent" : "muted",
    ...postingView(job, now),
    ...locationView(job),
    salaryLabel,
    salaryTone: job.salary ? "neutral" : "muted",
    summaryText: job.summary?.trim() || job.matchReason,
    matchedTerms: job.matchedTerms ?? [],
  };
}
