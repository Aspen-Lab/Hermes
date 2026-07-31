const FETCH_TIMEOUT_MS = 12_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const DEFAULT_CONCURRENCY = 8;

const PAGE_FETCH_USER_AGENT =
  "PeerBot/0.1 (+https://github.com/Aspen-Lab/peer; opportunity detail enrichment)";

export const UNFETCHABLE_HOSTS = [
  "10times.com",
  "battery-tech.net",
] as const;

// The measured AcademicJobsOnline (6 KB) and ACS (0.2 KB) responses are
// JavaScript shells, not usable posting pages.
//
// Measure the RAW response, not the visible text. Visible-text length cannot
// separate the two populations: careers.ornl.gov — a real, extractable posting
// page — strips to ~2 KB, exactly like the AcademicJobsOnline shell. Every real
// page measured (icml.cc, neurips.cc, electrochem.org, euraxess, ornl,
// nature.com, jobs.ac.uk) strips to 2–19 KB, so a 20 KB visible-text floor
// discarded all of them and silently disabled the whole extraction layer.
//
// Raw size does separate them cleanly: the two shells are 6 KB and 0.2 KB,
// while every real page is 47 KB or larger. A script bundle inflating a shell
// past 20 KB would slip through, but it then yields nothing and the extractors
// simply return empty — the failure mode is a wasted parse, not lost data.
export const MIN_USABLE_PAGE_BYTES = 20 * 1024;

export function hasUsableOpportunityPageText(html: string): boolean {
  return html.length >= MIN_USABLE_PAGE_BYTES;
}

function isUnfetchableUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return UNFETCHABLE_HOSTS.some(
      (blocked) => hostname === blocked || hostname.endsWith(`.${blocked}`),
    );
  } catch {
    return true;
  }
}

async function readResponseWithinLimit(response: Response): Promise<string | null> {
  const contentLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  );
  if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
    return null;
  }

  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let html = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      html += decoder.decode(value, { stream: true });
    }
    html += decoder.decode();
    return html;
  } finally {
    reader.releaseLock();
  }
}

export async function fetchPageHtml(url: string): Promise<string | null> {
  if (isUnfetchableUrl(url)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": PAGE_FETCH_USER_AGENT,
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
      },
    });
    if (!response.ok) return null;
    const html = await readResponseWithinLimit(response);
    if (!html || !hasUsableOpportunityPageText(html)) return null;
    return html;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchPagesConcurrently(
  urls: string[],
  limit = DEFAULT_CONCURRENCY,
): Promise<Array<string | null>> {
  if (urls.length === 0) return [];

  const normalizedLimit =
    Number.isFinite(limit) && limit > 0
      ? Math.max(1, Math.floor(limit))
      : DEFAULT_CONCURRENCY;
  const results = new Array<string | null>(urls.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < urls.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await fetchPageHtml(urls[index]);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(normalizedLimit, urls.length) },
      () => worker(),
    ),
  );
  return results;
}
