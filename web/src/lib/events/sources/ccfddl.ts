import { load } from "js-yaml";
import { sourceFetch } from "@/lib/sources/_fetch";
import { routeSafeId } from "@/lib/opportunities/shared";
import { extractPlaceFromText } from "@/lib/opportunities/structured-extract";
import type { EventSourceAdapter, EventsQuery, RawEventItem } from "../types";

// ccfddl/ccf-deadlines: community-maintained YAML of CS conference deadlines
// with CCF/CORE ranks. One aggregated file, refreshed daily server-side.
const ALLCONF_URL = "https://ccfddl.com/conference/allconf.yml";
const REVALIDATE_SECONDS = 24 * 60 * 60;

interface CcfTimelineEntry {
  deadline?: string;
  abstract_deadline?: string;
}

interface CcfConfYear {
  year?: number;
  id?: string;
  link?: string;
  timeline?: CcfTimelineEntry[];
  timezone?: string;
  date?: string;
  place?: string;
}

interface CcfConf {
  title?: string;
  description?: string;
  sub?: string;
  rank?: { ccf?: string; core?: string; thcpl?: string };
  confs?: CcfConfYear[];
}

// CCF category → English topic keywords, used as tags so the Tier-0 keyword
// gate can match user topics against short conference records ("AAAI" alone
// would never match "machine learning").
const SUB_KEYWORDS: Record<string, string[]> = {
  AI: [
    "artificial intelligence",
    "machine learning",
    "deep learning",
    "natural language processing",
    "computer vision",
    "robotics",
    "large language models",
    "llm",
    "foundation models",
    "generative ai",
    "transformers",
    "reinforcement learning",
    "multimodal",
  ],
  CG: ["computer graphics", "multimedia", "visualization", "virtual reality"],
  CT: ["theoretical computer science", "algorithms", "computational complexity"],
  DB: ["databases", "data mining", "information retrieval", "data management"],
  DS: [
    "computer architecture",
    "distributed systems",
    "parallel computing",
    "storage systems",
  ],
  HI: ["human-computer interaction", "hci", "ubiquitous computing"],
  MX: [
    "interdisciplinary computing",
    "computational biology",
    "bioinformatics",
    "quantum computing",
  ],
  NW: ["computer networks", "networking", "internet measurement"],
  SC: ["security", "privacy", "cryptography"],
  SE: ["software engineering", "programming languages", "operating systems"],
};

const MONTH_DAY_RE = /([A-Z][a-z]{2,})\.?\s+(\d{1,2})/g;
const YEAR_RE = /(\d{4})\s*$/;

/** Parse ccfddl's human date strings ("February 22 - March 1, 2026"). */
export function parseCcfDateRange(
  raw: string | undefined,
): { start?: string; end?: string } {
  if (!raw) return {};
  const yearMatch = raw.match(YEAR_RE);
  if (!yearMatch) return {};
  const year = yearMatch[1];
  const matches = Array.from(raw.matchAll(MONTH_DAY_RE));
  if (matches.length === 0) return {};
  const toIso = (month: string, day: string): string | undefined => {
    const ms = Date.parse(`${month} ${day}, ${year} 12:00:00 UTC`);
    return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
  };
  const start = toIso(matches[0][1], matches[0][2]);
  let end: string | undefined;
  if (matches.length > 1) {
    const last = matches[matches.length - 1];
    end = toIso(last[1], last[2]);
  } else {
    // "June 10-17, 2026" — same month, day range.
    const dayRange = raw.match(/(\d{1,2})\s*[-–]\s*(\d{1,2})/);
    if (dayRange) end = toIso(matches[0][1], dayRange[2]);
  }
  return { start, end };
}

/** ccfddl deadlines are 'YYYY-MM-DD HH:mm:ss' in a stated timezone; we
 * approximate as UTC — hour-level precision is irrelevant to daily scoring. */
export function parseCcfDeadline(raw: string | undefined): string | undefined {
  if (!raw || /tbd/i.test(raw)) return undefined;
  const ms = Date.parse(`${raw.trim().replace(" ", "T")}Z`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

export function ccfConfToRawItem(conf: CcfConf, now: number): RawEventItem | null {
  const title = conf.title?.trim();
  const years = conf.confs ?? [];
  if (!title || years.length === 0) return null;

  // Latest edition that is still upcoming (future deadline or future date).
  for (let i = years.length - 1; i >= 0; i--) {
    const edition = years[i];
    const { start, end } = parseCcfDateRange(edition.date);
    const deadlines = (edition.timeline ?? [])
      .flatMap((t) => [parseCcfDeadline(t.deadline), parseCcfDeadline(t.abstract_deadline)])
      .filter((d): d is string => Boolean(d));
    const futureDeadlines = deadlines
      .filter((d) => Date.parse(d) > now)
      .sort();
    const startsInFuture = start ? Date.parse(start) > now : false;
    if (!startsInFuture && futureDeadlines.length === 0) continue;

    const rank = [
      conf.rank?.ccf ? `CCF ${conf.rank.ccf}` : "",
      conf.rank?.core ? `CORE ${conf.rank.core}` : "",
    ]
      .filter(Boolean)
      .join(" · ");
    const place = edition.place?.trim() ?? "";
    const isOnline = /\b(online|virtual|hybrid)\b/i.test(place);
    return {
      id: `ccfddl:${routeSafeId(edition.id ?? `${title}-${edition.year}`)}`,
      source: "ccfddl",
      name: `${title} ${edition.year ?? ""}`.trim(),
      type: "conference",
      startDate: start ?? "",
      endDate: end,
      location: isOnline ? "Online" : place,
      place: extractPlaceFromText(place),
      isOnline,
      deadline: futureDeadlines[0],
      description: conf.description?.trim() ?? title,
      url: edition.link?.trim() ?? "",
      rank: rank || undefined,
      tags: [conf.sub ?? "", ...(SUB_KEYWORDS[conf.sub ?? ""] ?? [])].filter(Boolean),
    };
  }
  return null;
}

async function fetchImpl(query: EventsQuery): Promise<RawEventItem[]> {
  const res = await sourceFetch(ALLCONF_URL, {
    revalidate: REVALIDATE_SECONDS,
    timeoutMs: 7000,
  });
  if (!res.ok) {
    console.error("[events/ccfddl] non-ok response:", res.status);
    return [];
  }
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = load(text);
  } catch (err) {
    console.error("[events/ccfddl] yaml parse error:", err);
    return [];
  }
  if (!Array.isArray(parsed)) return [];

  const now = Date.now();
  const items: RawEventItem[] = [];
  for (const conf of parsed as CcfConf[]) {
    const item = ccfConfToRawItem(conf, now);
    if (item) items.push(item);
    if (items.length >= query.limit) break;
  }
  return items;
}

export const ccfddl: EventSourceAdapter = {
  id: "ccfddl",
  enabled: () => true,
  fetch: fetchImpl,
};
