// Shared date / relative-time / count / percent formatting.
//
// This is the ONLY place these live — do not hand-roll a formatter inside a
// page or card. Before this module existed the app had five relative-time
// vocabularies ("2d ago" vs "2 days ago" vs "in 2 days") drifting across
// adjacent surfaces.

const DAY_MS = 86_400_000;

/**
 * Parse an ISO string. Date-only strings ("2026-07-19") are parsed as LOCAL
 * dates — `new Date("2026-07-19")` parses as UTC midnight, which renders as
 * the previous day in western timezones. Event dates and publication dates
 * must never shift by a day.
 */
export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const d = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export type DateStyle = "full" | "medium" | "short" | "monthYear";

const DATE_STYLE_OPTS: Record<DateStyle, Intl.DateTimeFormatOptions> = {
  full: { weekday: "long", month: "long", day: "numeric", year: "numeric" },
  medium: { month: "short", day: "numeric", year: "numeric" },
  short: { month: "short", day: "numeric" },
  monthYear: { month: "short", year: "numeric" },
};

/** Absolute date — "Sunday, July 19, 2026" / "Jul 19, 2026" / "Jul 19" / "Jul 2026". */
export function formatDate(
  iso: string | null | undefined,
  style: DateStyle = "medium",
): string | null {
  const d = parseDate(iso);
  if (!d) return null;
  return d.toLocaleDateString("en-US", DATE_STYLE_OPTS[style]);
}

/**
 * B-05. Compact date range for an event's DATES tile — "Mar 8 – 11, 2027",
 * "Mar 30 – Apr 2, 2027", "Dec 30, 2026 – Jan 2, 2027". Collapses whatever the
 * two ends share. The event report used to print the start in "full" style and
 * the end in "medium", joined by a dot: "Monday, March 8, 2027 · Mar 11, 2027".
 */
export function formatDateRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string | null {
  const start = parseDate(startIso);
  if (!start) return null;
  const end = parseDate(endIso);
  if (!end || end.getTime() <= start.getTime()) return formatDate(startIso);

  const monthDay = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  if (start.getFullYear() !== end.getFullYear()) {
    return `${formatDate(startIso)} – ${formatDate(endIso)}`;
  }
  const head =
    start.getMonth() === end.getMonth()
      ? `${monthDay(start)} – ${end.getDate()}`
      : `${monthDay(start)} – ${monthDay(end)}`;
  return `${head}, ${end.getFullYear()}`;
}

/** B-05. Weekday span beneath a date range — "Mon – Thu", or "Mon" for a day. */
export function formatWeekdayRange(
  startIso: string | null | undefined,
  endIso: string | null | undefined,
): string | null {
  const start = parseDate(startIso);
  if (!start) return null;
  const weekday = (d: Date) =>
    d.toLocaleDateString("en-US", { weekday: "short" });
  const end = parseDate(endIso);
  if (!end || end.getTime() <= start.getTime()) return weekday(start);
  return `${weekday(start)} – ${weekday(end)}`;
}

/**
 * Clock-granularity past time for sync stamps and activity rows:
 * "just now", "12m ago", "3h ago", "5d ago", then the absolute date.
 */
export function formatTimeAgo(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  const d = parseDate(iso);
  if (!d) return null;
  const mins = Math.floor((nowMs - d.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso, "short");
}

/**
 * Day-granularity content age for posted/published stamps:
 * "Today", "Yesterday", "5d ago", "3w ago", then "Jul 2026".
 */
export function formatDayAge(
  iso: string | null | undefined,
  nowMs: number = Date.now(),
): string | null {
  const d = parseDate(iso);
  if (!d) return null;
  const diff = Math.floor((nowMs - d.getTime()) / DAY_MS);
  if (diff < 1) return "Today";
  if (diff < 2) return "Yesterday";
  if (diff < 14) return `${diff}d ago`;
  if (diff < 60) return `${Math.floor(diff / 7)}w ago`;
  return formatDate(iso, "monthYear");
}

/** Signed whole days from now to `iso` (positive = future). For deadlines. */
export function daysUntil(iso: string, nowMs: number = Date.now()): number {
  const d = parseDate(iso);
  if (!d) return 0;
  return Math.round((d.getTime() - nowMs) / DAY_MS);
}

/**
 * Bidirectional day distance in words, for deadlines and event dates:
 * "today", "tomorrow", "in 5 days", "2 weeks ago", "in 3 months"…
 */
export function formatDayDistance(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  if (days > 0 && days < 14) return `in ${days} days`;
  if (days < 0 && days > -14) return `${Math.abs(days)} days ago`;
  if (days >= 14 && days < 60) return `in ${Math.floor(days / 7)} weeks`;
  if (days <= -14 && days > -60) return `${Math.floor(Math.abs(days) / 7)} weeks ago`;
  if (days >= 60 && days < 365) return `in ${Math.floor(days / 30)} months`;
  if (days <= -60 && days > -365) return `${Math.floor(Math.abs(days) / 30)} months ago`;
  if (days >= 365) return `in ${Math.floor(days / 365)} years`;
  return `${Math.floor(Math.abs(days) / 365)} years ago`;
}

/**
 * B2-01. Report-only countdown vocabulary. Plate 02 and 03 always read
 * "N days left" / "N days ago" — never bucketed into weeks or months, and
 * never abbreviated to "Nd". `formatDayDistance` / `formatDayAge` above keep
 * serving the feed, the papers view and job cards exactly as before; those
 * surfaces have their own established relative-time vocabulary and are not
 * part of this loop. These two exist only so the job and event reports stop
 * needing to hand-roll a fourth vocabulary inline — the exact drift this
 * module's header comment warns about.
 */
export function formatDaysLeft(days: number): string {
  if (days <= 0) return "due today";
  return `${days} day${days === 1 ? "" : "s"} left`;
}

/** B2-01. The past-tense half of the pair above — "8 days ago", not "8d ago". */
export function formatDaysAgo(days: number): string {
  if (days <= 0) return "today";
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

/**
 * Long-form past age in words for prose contexts:
 * "today", "yesterday", "12 days ago", "3 months ago", "1.5 years ago".
 */
export function formatAgeInWords(days: number): string {
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 60) return "1 month ago";
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  const years = days / 365;
  if (years < 1.5) return "1 year ago";
  return `${years.toFixed(1).replace(/\.0$/, "")} years ago`;
}

/** Compact count — 842, 1.2k, 34k, 1.1M. */
export function formatCount(n: number): string {
  if (n < 1000) return n.toString();
  if (n < 10_000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  if (n < 1_000_000) return Math.round(n / 1000) + "k";
  return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
}

/** Relevance score (0–1, may arrive dirty) → integer percent, clamped. */
export function formatMatchPct(
  score: number | null | undefined,
): number | null {
  if (score == null) return null;
  return Math.round(Math.max(0, Math.min(1, score)) * 100);
}
