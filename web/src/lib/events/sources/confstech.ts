import { sourceFetch } from "@/lib/sources/_fetch";
import type { EventSourceAdapter, EventsQuery, RawEventItem } from "../types";

// confs.tech community data: JSON files per topic per year on GitHub. Tech
// (rather than academic) conferences — useful for applied/industry-leaning
// researchers, weighted below the academic sources by the scorer.
const BASE_URL =
  "https://raw.githubusercontent.com/tech-conferences/conference-data/main/conferences";
const REVALIDATE_SECONDS = 24 * 60 * 60;

interface ConfsTechConf {
  name?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
  city?: string;
  country?: string;
  online?: boolean;
  cfpUrl?: string;
  cfpEndDate?: string;
}

// User-topic keyword → confs.tech topic file.
const TOPIC_FILES: Array<[RegExp, string]> = [
  [/machine learning|artificial intelligence|deep learning|data|nlp|language model|llm|computer vision|statistics/i, "data"],
  [/security|privacy|cryptograph/i, "security"],
  [/human.computer|hci|design|ux|user experience/i, "ux"],
  [/network/i, "networking"],
  [/python/i, "python"],
  [/javascript|web/i, "javascript"],
  [/rust/i, "rust"],
  [/devops|infrastructure|cloud|systems/i, "devops"],
];

export function confsTechTopicFiles(topics: string[]): string[] {
  const files = new Set<string>(["general"]);
  for (const topic of topics) {
    for (const [re, file] of TOPIC_FILES) {
      if (re.test(topic)) files.add(file);
    }
  }
  return Array.from(files).slice(0, 3);
}

export function confsTechConfToRawItem(
  conf: ConfsTechConf,
  topicFile: string,
  now: number,
): RawEventItem | null {
  const name = conf.name?.trim();
  const url = conf.url?.trim();
  const startDate = conf.startDate?.trim();
  if (!name || !url || !startDate) return null;
  const startMs = Date.parse(startDate);
  if (!Number.isFinite(startMs) || startMs < now) return null;
  const deadlineMs = conf.cfpEndDate ? Date.parse(conf.cfpEndDate) : NaN;
  const location = [conf.city, conf.country].filter(Boolean).join(", ");
  return {
    id: `confstech:${name}-${startDate}`,
    source: "confstech",
    name,
    type: "conference",
    startDate: new Date(startMs).toISOString(),
    endDate: conf.endDate,
    location: conf.online && !location ? "Online" : location,
    isOnline: Boolean(conf.online),
    deadline:
      Number.isFinite(deadlineMs) && deadlineMs > now
        ? new Date(deadlineMs).toISOString()
        : undefined,
    description: `${name} — ${topicFile} conference`,
    url,
    registrationUrl: conf.cfpUrl,
    tags: [topicFile, "tech conference"],
  };
}

async function fetchImpl(query: EventsQuery): Promise<RawEventItem[]> {
  const now = Date.now();
  const year = new Date(now).getFullYear();
  // Late in the year the interesting conferences are mostly next year's.
  const years = new Date(now).getMonth() >= 8 ? [year, year + 1] : [year];
  const files = confsTechTopicFiles(query.topics);

  const items: RawEventItem[] = [];
  await Promise.all(
    years.flatMap((y) =>
      files.map(async (file) => {
        try {
          const res = await sourceFetch(`${BASE_URL}/${y}/${file}.json`, {
            revalidate: REVALIDATE_SECONDS,
          });
          if (!res.ok) return;
          const data = (await res.json()) as ConfsTechConf[];
          for (const conf of data) {
            const item = confsTechConfToRawItem(conf, file, now);
            if (item) items.push(item);
          }
        } catch (err) {
          console.error(`[events/confstech] ${y}/${file} error:`, err);
        }
      }),
    ),
  );
  return items.slice(0, query.limit);
}

export const confstech: EventSourceAdapter = {
  id: "confstech",
  enabled: () => true,
  fetch: fetchImpl,
};
