import { sourceFetch } from "@/lib/sources/_fetch";
import { routeSafeId } from "@/lib/opportunities/shared";
import type { EventSourceAdapter, EventsQuery, RawEventItem } from "../types";

// researchseminars.org: cross-discipline registry of research seminars and
// talks (math/physics/CS-heavy, MIT-run). Free JSON API, no auth. This is the
// main non-CS academic source, so keep it healthy.
const REVALIDATE_SECONDS = 6 * 60 * 60;

interface RsTalk {
  title?: string;
  abstract?: string;
  seminar_id?: string;
  seminar_ctr?: number;
  start_time?: string;
  end_time?: string;
  online?: boolean;
  room?: string;
  speaker?: string;
  speaker_affiliation?: string;
  topics?: string[];
  deleted?: boolean;
  display?: boolean;
  language?: string;
}

interface RsResponse {
  code?: string;
  results?: RsTalk[];
}

// researchseminars topic codes → English keywords for the Tier-0 keyword gate.
const TOPIC_KEYWORDS: Array<[RegExp, string[]]> = [
  [/^math/, ["mathematics"]],
  [/^physics|^gr-qc|^hep|^cond-mat|^astro-ph|^nucl|^quant-ph|^math-ph/, ["physics"]],
  [/^gr-qc/, ["general relativity", "gravitation"]],
  [/^hep/, ["high energy physics", "particle physics"]],
  [/^quant-ph/, ["quantum physics", "quantum computing"]],
  [/^cond-mat/, ["condensed matter", "materials"]],
  [/^astro-ph/, ["astrophysics", "astronomy", "cosmology"]],
  [/^cs/, ["computer science"]],
  [/^stat/, ["statistics"]],
  [/^q-bio|^bio/, ["biology", "computational biology"]],
  [/^econ/, ["economics"]],
  [/^eess/, ["electrical engineering", "signal processing"]],
  [/^q-fin/, ["quantitative finance"]],
];

export function expandRsTopics(codes: string[]): string[] {
  const out = new Set<string>(codes);
  for (const code of codes) {
    for (const [re, keywords] of TOPIC_KEYWORDS) {
      if (re.test(code)) keywords.forEach((k) => out.add(k));
    }
  }
  return Array.from(out);
}

function parseRsTime(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const ms = Date.parse(raw.replace(" ", "T"));
  return Number.isFinite(ms) ? new Date(ms).toISOString() : undefined;
}

export function rsTalkToRawItem(talk: RsTalk): RawEventItem | null {
  const title = talk.title?.trim();
  const seminarId = talk.seminar_id?.trim();
  if (!title || !seminarId || talk.seminar_ctr === undefined) return null;
  if (talk.deleted || talk.display === false) return null;
  const startDate = parseRsTime(talk.start_time);
  if (!startDate) return null;
  const speaker = [talk.speaker, talk.speaker_affiliation]
    .filter(Boolean)
    .join(", ");
  return {
    id: `researchseminars:${routeSafeId(`${seminarId}-${talk.seminar_ctr}`)}`,
    source: "researchseminars",
    name: title,
    type: "seminar",
    startDate,
    endDate: parseRsTime(talk.end_time),
    location: talk.online ? "Online" : talk.room?.trim() || "See seminar page",
    isOnline: Boolean(talk.online),
    description: [speaker ? `Speaker: ${speaker}.` : "", talk.abstract ?? ""]
      .filter(Boolean)
      .join(" ")
      .slice(0, 1200),
    url: `https://researchseminars.org/talk/${seminarId}/${talk.seminar_ctr}/`,
    tags: expandRsTopics(talk.topics ?? []),
  };
}

async function fetchImpl(query: EventsQuery): Promise<RawEventItem[]> {
  // Upcoming talks in the next 30 days (~200 rows currently).
  const from = new Date().toISOString().slice(0, 19);
  const params = new URLSearchParams({
    start_time: JSON.stringify({ $gte: from }),
  });
  const res = await sourceFetch(
    `https://researchseminars.org/api/0/search/talks?${params}`,
    { revalidate: REVALIDATE_SECONDS },
  );
  if (!res.ok) {
    console.error("[events/researchseminars] non-ok response:", res.status);
    return [];
  }
  const data = (await res.json()) as RsResponse;
  if (data.code !== "success") return [];
  const horizonMs = Date.now() + 30 * 24 * 60 * 60 * 1000;
  return (data.results ?? [])
    .map(rsTalkToRawItem)
    .filter((item): item is RawEventItem => item !== null)
    .filter((item) => Date.parse(item.startDate) <= horizonMs)
    .slice(0, query.limit);
}

export const researchseminars: EventSourceAdapter = {
  id: "researchseminars",
  enabled: () => true,
  fetch: fetchImpl,
};
