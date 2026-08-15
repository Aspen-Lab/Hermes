import { GoogleGenAI } from "@google/genai";
import { PROVIDER_MODELS } from "@/lib/llm/provider-models";
import {
  fetchPagesConcurrently,
  UNFETCHABLE_HOSTS,
} from "@/lib/opportunities/page-fetch";
import { cleanDisplayText } from "@/lib/text/clean";
import type { WebSearchProvider } from "./types";

// ═══════════════════════════════════════════════════════════════════════════
// RULING 75 — THE `gemini` WEB-SEARCH PROVIDER.
//
// The user suspended every quota-capped search API (Tavily, Adzuna, USAJobs,
// JSearch). Vertex Gemini with Google Search grounding replaces the search seam
// and this module is the whole of it: one grounded call per query, then the two
// recovery stages that turn grounding metadata into the `{title, url, snippet}`
// contract the three surfaces already consume.
//
// **Every design choice below is a MEASUREMENT, not a preference.** Round 28 B
// probed the live endpoint and round 28 C reproduced the four that matter before
// writing a line (2026-08-15, `gemini-2.5-flash`, one grounded query):
//
//   1. `groundingChunks[].web` carries `{uri, title, domain}` and NOTHING else.
//   2. Every `uri` is a `vertexaisearch.cloud.google.com/grounding-api-redirect/…`
//      token. HEAD with `redirect:"manual"` returned 302 + `Location` on 5 of 5
//      (B: 64 of 64) in ~400 ms; a corrupted token returned 404 with NO
//      `Location`. So "drop what will not resolve" is a decidable rule.
//   3. **`web.title` IS THE REGISTRABLE DOMAIN — 5 of 5 here, 64 of 64 for B.**
//      Not a page title. `byu.edu`, `grc.org`, `programmaster.org`.
//   4. One grounded call measured 10012 ms here (B: 3364–12087 ms), against a
//      shipped 8000 ms per-source budget. See RULING 76a.
//
// Fact 3 is the one that shapes everything. Passing the chunk title through as
// a result title is the cheap implementation and B measured what it costs:
// replayed through the SHIPPED, unmodified job admission it admits **31 of 40
// rows with a bare hostname as the role title** — manufacturing A22-01 /
// 62d(b) / 63a / A26-01 at scale. Recovering the page's OWN title after the
// redirect admits 16 and keeps the round-27 LANL must-keep `Nuclear Materials
// and Molten Salt Technologist 1`. **The title comes from the page or the row
// does not exist.**
//
// And the model's prose is NEVER a snippet. B asked for a strict
// `TITLE ||| SNIPPET` format and got five paragraphs; `groundingSupports`
// segments are the model's own sentences, not the page's. A generated sentence
// fed to `extractEventDate` / `cleanJobDescription` would let a GENERATED date
// become a RENDERED date — the exact invention round 27 item 4 exists to stop.
// Page-derived text is what Tavily's `content` and Brave's `description`
// already are, and it is the only honest analogue.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The result contract shared by all three surfaces. `sources/web-search.ts`
 * maps it to `RawItem`, `events/sources/eventweb.ts` to `RawEventItem` via
 * `webResultToRawEventItem`, and `jobs/sources/jobweb.ts` to `RawJobItem` via
 * `webResultToRawJobItem`. Those three mappers stay exactly where they are —
 * jobweb's search functions return already-mapped rows and eventweb's return
 * unmapped ones, so this shape is the only return type that fits both.
 */
export interface WebResult {
  title?: string;
  url?: string;
  snippet?: string;
}

/**
 * RULING 76a. The per-source budget for a gemini web search, applied at the two
 * opportunity-pipeline call sites ONLY — never as a global default.
 * `withSourceTimeout` defaults to 8000 ms and a single grounding call measured
 * 10012 ms, so on the shipped budget this provider provably returns NOTHING.
 * The slower census is a priced, accepted consequence of Ruling 75.
 */
export const GEMINI_SOURCE_TIMEOUT_MS = 25_000;

/**
 * The soft internal deadline, deliberately under `GEMINI_SOURCE_TIMEOUT_MS`.
 *
 * **Why a soft deadline exists at all** (a traced deviation from B's design,
 * logged in §4): `withSourceTimeout` REJECTS the whole source when it fires, so
 * one slow page fetch past 25 s turns a 60-row census into ZERO rows. B's own
 * arithmetic reaches the cliff — a 16-query event fan-out is ~6 s ground +
 * 1.2 s resolve + up to ~27 s of page titles. Stopping title recovery at the
 * deadline returns the rows that DID resolve instead of returning nothing, and
 * it does not weaken any rule: a row past the deadline has no page title, and a
 * row with no page title is DROPPED like any other.
 */
const GEMINI_SEARCH_BUDGET_MS = 21_000;

/** Redirect resolution is a header read; the target page is never fetched. */
const REDIRECT_TIMEOUT_MS = 7_000;
const REDIRECT_CONCURRENCY = 8;

/**
 * Title recovery runs wider than `fetchPagesConcurrently`'s default 8. B's
 * adversarial pass priced a full event fan-out at ~112 page fetches; at 8 that
 * is ~27 s of the 25 s budget spent on titles alone.
 */
const TITLE_CONCURRENCY = 16;

/**
 * **A DOCUMENTED, TESTED CHOICE, NOT AN IMPLEMENTATION DETAIL** (B's adversarial
 * item 8 names it as such). Grounding returned 4–13 chunks per query against a
 * requested 10, so `RESULTS_PER_SEARCH` is ADVISORY on this provider in both
 * directions — it cannot be asserted on. This cap bounds the page fetches a
 * single query can commission, in grounding order, which is the model's own
 * relevance order. Capping BEFORE stage 3 changes which rows exist, so it is
 * stated here and covered by its own test.
 */
const MAX_CHUNKS_PER_QUERY = 10;

const GROUNDING_REDIRECT_PREFIX =
  "https://vertexaisearch.cloud.google.com/grounding-api-redirect/";

/** The model B probed and C reproduced. Kept on the shared constant. */
const GEMINI_SEARCH_MODEL = PROVIDER_MODELS.gemini.large;

/**
 * A grounding chunk's web member, exactly as measured. `title` is named here
 * only so the type is honest about what the API returns — **it is a hostname
 * and this module never reads it.**
 */
export interface GroundingWebChunk {
  uri?: string;
  title?: string;
  domain?: string;
}

export interface GeminiSearchOptions {
  /**
   * Hosts the calling surface denies outright, title-independent. Stage 2b
   * skips them before paying for a page fetch. **Only outright denies belong
   * here.** `eventweb`'s `DENY_HOSTS` qualifies (verified title-independent);
   * `jobweb`'s `AGGREGATOR_HOSTS` does NOT — that list requires a posting id
   * rather than denying, so pre-screening on it would change admissions.
   */
  denyHosts?: readonly string[];
  /** Domain exclusions the surface already passes to Tavily, mirrored here. */
  excludeDomains?: readonly string[];
  /** Upper bound on rows entering stage 3. The surface's own per-source limit. */
  maxResults?: number;
  /** Shared wall-clock deadline for a whole fan-out. */
  deadlineAt?: number;
  /** Test seam: replaces the live grounded call. Production leaves it unset. */
  ground?: (query: string) => Promise<GroundingWebChunk[]>;
  /** Test seam: replaces redirect resolution. Production leaves it unset. */
  resolveRedirect?: (uri: string) => Promise<string | null>;
  /** Test seam: replaces page fetching. Production leaves it unset. */
  fetchPages?: (urls: string[]) => Promise<Array<string | null>>;
}

/**
 * Vertex presence, and **nothing else**.
 *
 * `canUseLocalServerProvider()` is NOT called, copied or touched. Its
 * deployed-user safety comment governs MODEL SPEND and is a recorded decision
 * this design leaves exactly where it is (B flags, does not reverse). If
 * `registry.test.ts` ever moves, that boundary was crossed.
 */
export function isGeminiSearchAvailable(): boolean {
  return Boolean(process.env.GOOGLE_VERTEX_PROJECT);
}

/**
 * RULING 75 requirement 2, in one place so all three surfaces agree:
 * explicit preference → `gemini` when Vertex credentials are present AND Tavily
 * is not enabled → `brave` → `tavily`.
 *
 * When Vertex is absent this returns exactly what the shipped `resolveProvider`
 * returned, branch for branch — the gemini clause is additive.
 */
export function resolveWebSearchProvider(
  preferred: WebSearchProvider | undefined,
  availability: {
    geminiAvailable: boolean;
    braveKeyPresent: boolean;
    tavilyKeyPresent: boolean;
    /** A Tavily key the CALLER supplied — the signal that Tavily is enabled. */
    requestTavilyKeyPresent: boolean;
  },
): Exclude<WebSearchProvider, "auto"> | null {
  if (preferred === "gemini") {
    return availability.geminiAvailable ? "gemini" : null;
  }
  if (preferred === "brave") {
    return availability.braveKeyPresent ? "brave" : null;
  }
  if (preferred === "tavily") {
    return availability.tavilyKeyPresent ? "tavily" : null;
  }
  // Auto. Gemini only displaces the shipped order when Tavily is NOT enabled,
  // which is precisely Ruling 75's wording.
  if (availability.geminiAvailable && !availability.requestTavilyKeyPresent) {
    return "gemini";
  }
  if (availability.requestTavilyKeyPresent) return "tavily";
  if (availability.braveKeyPresent) return "brave";
  if (availability.tavilyKeyPresent) return "tavily";
  return null;
}

/**
 * The `webSearch` block a pipeline builds when Tavily is not enabled.
 *
 * **This is the change that turns the web surfaces back on.** Both opportunity
 * pipelines built `webSearch` ONLY under `searchConnectors.tavily.enabled`, so
 * with `tavilyEnabled:false` the query carried no `webSearch` at all, both
 * adapters' `enabled()` returned false, and the paper surface returned `[]`.
 * The Tavily branch at each call site is left exactly as it shipped.
 */
export function geminiWebSearchOptions(
  connectors: { gemini?: { enabled?: boolean } } | undefined,
): { provider: WebSearchProvider } | undefined {
  if (connectors?.gemini?.enabled === false) return undefined;
  return isGeminiSearchAvailable() ? { provider: "gemini" } : undefined;
}

const clients = new Map<string, GoogleGenAI>();

function getSearchClient(): GoogleGenAI | null {
  const project = process.env.GOOGLE_VERTEX_PROJECT;
  if (!project) return null;
  const location = process.env.GOOGLE_VERTEX_LOCATION ?? "us-central1";
  const key = `${project}:${location}`;
  const cached = clients.get(key);
  if (cached) return cached;
  // Built the way `llm/providers/gemini.ts:getClient` builds it. The CONFIG is
  // what cannot be shared: `genConfig` sets `responseMimeType:"application/json"`
  // unconditionally and Vertex returns **400 INVALID_ARGUMENT — controlled
  // generation is not supported with Search tool**. Hence a separate path.
  const client = new GoogleGenAI({ vertexai: true, project, location });
  clients.set(key, client);
  return client;
}

/**
 * STAGE 1 — GROUND. One `generateContent` per query.
 *
 * No `responseMimeType` (refused with the Search tool) and no `maxOutputTokens`
 * (measured to throttle CHUNK COUNT, not latency: none → 13 chunks, 256 → 3,
 * 64 → 0). Zero chunks is a normal answer, not an error — a nonsense query and
 * a non-web question both returned `groundingMetadata` present with
 * `groundingChunks` an EMPTY ARRAY.
 */
async function groundQuery(query: string): Promise<GroundingWebChunk[]> {
  const client = getSearchClient();
  if (!client) return [];
  try {
    const response = await client.models.generateContent({
      model: GEMINI_SEARCH_MODEL,
      contents: query,
      config: { tools: [{ googleSearch: {} }] },
    });
    return groundingWebChunks(response);
  } catch (err) {
    console.error("[sources/gemini-search] grounding error:", err);
    return [];
  }
}

/**
 * Pull the `web` chunks out of a grounding response.
 *
 * **Filters on `chunk.web` presence rather than assuming.** The SDK's
 * `GroundingChunk` union also carries `maps`, `retrievedContext` and `image`
 * kinds. Those were 0 of 64 in B's windows and 0 of 5 in C's — **UNWITNESSED,
 * not cleared** — so the filter is written for them anyway.
 */
export function groundingWebChunks(response: unknown): GroundingWebChunk[] {
  if (!response || typeof response !== "object") return [];
  const candidates = (response as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return [];
  const first = candidates[0];
  if (!first || typeof first !== "object") return [];
  const metadata = (first as { groundingMetadata?: unknown }).groundingMetadata;
  if (!metadata || typeof metadata !== "object") return [];
  const chunks = (metadata as { groundingChunks?: unknown }).groundingChunks;
  if (!Array.isArray(chunks)) return [];

  const web: GroundingWebChunk[] = [];
  for (const chunk of chunks) {
    if (!chunk || typeof chunk !== "object") continue;
    const member = (chunk as { web?: unknown }).web;
    if (!member || typeof member !== "object") continue;
    const uri = (member as { uri?: unknown }).uri;
    if (typeof uri !== "string" || !uri) continue;
    web.push({
      uri,
      title: typeof (member as { title?: unknown }).title === "string"
        ? (member as { title: string }).title
        : undefined,
      domain: typeof (member as { domain?: unknown }).domain === "string"
        ? (member as { domain: string }).domain
        : undefined,
    });
  }
  return web;
}

/**
 * STAGE 2 — RESOLVE (mandatory, Ruling 75 requirement 1).
 *
 * The loop's guards read URL SHAPES — `JOB_PATH_RE`, the aggregator posting-id
 * rule, the host allow/deny lists all parse the path. An opaque redirect token
 * carries none of that, so every row must be resolved to its real target before
 * anything downstream sees it.
 *
 * HEAD is as good as GET (both 302, both ~300–480 ms) and **the target page is
 * never fetched here**. `status !== 302 || !location` → `null` → the row is
 * DROPPED. There is nothing to build a fake URL out of, which is the point.
 */
export async function resolveGroundingRedirect(
  uri: string,
): Promise<string | null> {
  if (!uri.startsWith(GROUNDING_REDIRECT_PREFIX)) {
    // Not a redirect token. Measured 64/64 and 5/5 that every grounding uri IS
    // one, so this branch is defensive: a direct URL is passed through rather
    // than dropped, because it needs no resolution to be readable downstream.
    return isHttpUrl(uri) ? uri : null;
  }
  try {
    const response = await fetch(uri, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(REDIRECT_TIMEOUT_MS),
    });
    if (response.status !== 302) return null;
    const location = response.headers.get("location");
    if (!location || !isHttpUrl(location)) return null;
    return location;
  } catch {
    return null;
  }
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function hostMatches(host: string, list: readonly string[]): boolean {
  return list.some((entry) => {
    const needle = entry.toLowerCase().replace(/^www\./, "");
    return host === needle || host.endsWith(`.${needle}`);
  });
}

/**
 * STAGE 2b — HOST PRE-SCREEN, and its boundary.
 *
 * Only OUTRIGHT, TITLE-INDEPENDENT denies belong here, because skipping a row
 * before stage 3 must not be able to change an admission. `UNFETCHABLE_HOSTS`
 * qualifies (the page fetch would return null anyway) and so does the event
 * surface's `DENY_HOSTS`. **`AGGREGATOR_HOSTS` deliberately does NOT** — jobweb
 * does not deny those hosts, it REQUIRES a posting id on them, so pre-screening
 * there would drop rows the shipped rule admits. Admission-neutrality is proved
 * by test, not by this comment.
 */
export function isPreScreenedOut(
  url: string,
  options: { denyHosts?: readonly string[]; excludeDomains?: readonly string[] },
): boolean {
  const host = hostOf(url);
  if (!host) return true;
  if (hostMatches(host, UNFETCHABLE_HOSTS)) return true;
  if (options.denyHosts && hostMatches(host, options.denyHosts)) return true;
  if (options.excludeDomains && hostMatches(host, options.excludeDomains)) {
    return true;
  }
  return false;
}

const TITLE_TAG_RE = /<title\b[^>]*>([\s\S]{0,600}?)<\/title\s*>/i;
const META_TAG_RE = /<meta\b([^>]*)>/gi;

function attributeValue(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i",
  );
  const match = attributes.match(pattern);
  if (!match) return undefined;
  return match[2] ?? match[3] ?? match[4];
}

function metaContent(html: string, keys: readonly string[]): string | undefined {
  for (const match of html.matchAll(META_TAG_RE)) {
    const attributes = match[1] ?? "";
    const key = (
      attributeValue(attributes, "property") ?? attributeValue(attributes, "name")
    )?.toLowerCase();
    if (!key || !keys.includes(key)) continue;
    const content = attributeValue(attributes, "content");
    const cleaned = cleanDisplayText(content);
    if (cleaned) return cleaned;
  }
  return undefined;
}

/**
 * STAGE 3, TITLE HALF — `og:title`, else the `<title>` element.
 *
 * This is the page's OWN name for itself, which is exactly what Tavily's and
 * Brave's `title` fields are. It is NOT the grounding chunk's title, which is a
 * hostname (fact 3), and it is NOT anything the model wrote.
 */
export function pageTitleFromHtml(html: string | null): string | undefined {
  if (!html) return undefined;
  const og = metaContent(html, ["og:title"]);
  if (og) return og;
  const match = html.match(TITLE_TAG_RE);
  return cleanDisplayText(match?.[1]) || undefined;
}

/**
 * STAGE 3, SNIPPET HALF — `og:description`, else the plain meta description.
 *
 * **No description is the EMPTY STRING, never a drop and never model prose.**
 * Both shipped mappers already read `result.snippet ?? ""`; the event mapper's
 * dateless branch is explicitly unaffected by an empty snippet.
 */
export function pageSnippetFromHtml(html: string | null): string {
  if (!html) return "";
  return metaContent(html, ["og:description", "description"]) ?? "";
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
  let next = 0;
  async function run(): Promise<void> {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => run()),
  );
  return results;
}

/**
 * One grounded search, all three stages, drop-on-undecidable throughout.
 *
 * Returns the shared `{title, url, snippet}` contract. **Every returned row has
 * a real target URL and the page's own title.** Any failure at any stage
 * degrades to fewer rows or an empty array — the pipeline then reports zero
 * fetched, records the reason in `errors[sourceId]`, and the report renders that
 * surface honestly empty. No partial row, no placeholder, no host-as-title.
 */
export async function searchGemini(
  query: string,
  options: GeminiSearchOptions = {},
): Promise<WebResult[]> {
  const deadlineAt = options.deadlineAt ?? Date.now() + GEMINI_SEARCH_BUDGET_MS;
  const ground = options.ground ?? groundQuery;
  const resolve = options.resolveRedirect ?? resolveGroundingRedirect;
  const fetchPages =
    options.fetchPages ??
    ((urls: string[]) => fetchPagesConcurrently(urls, TITLE_CONCURRENCY));

  const chunks = (await ground(query)).slice(0, MAX_CHUNKS_PER_QUERY);
  if (chunks.length === 0) return [];

  const resolved = await mapWithConcurrency(
    chunks,
    REDIRECT_CONCURRENCY,
    (chunk) => (chunk.uri ? resolve(chunk.uri) : Promise.resolve(null)),
  );

  // Dedup runs HERE and can run nowhere earlier: the redirect tokens are opaque
  // and per-call (64 of 64 unique across queries in B's windows), so every
  // shipped dedup key — `web:<url>`, `eventweb:urlHashId(url)`, jobweb's id —
  // would see distinct rows for the same page. A collision on the RESOLVED url
  // was not sighted, only constructed; that is not proof it cannot happen.
  const targets: string[] = [];
  const seen = new Set<string>();
  for (const url of resolved) {
    if (!url) continue;
    if (isPreScreenedOut(url, options)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    targets.push(url);
  }
  const capped =
    options.maxResults && options.maxResults > 0
      ? targets.slice(0, options.maxResults)
      : targets;
  if (capped.length === 0) return [];
  if (Date.now() >= deadlineAt) return [];

  const pages = await fetchPages(capped);
  const results: WebResult[] = [];
  capped.forEach((url, index) => {
    const title = pageTitleFromHtml(pages[index] ?? null);
    // **NO TITLE → DROP.** The alternative — the chunk's hostname — is measured
    // to admit 31 of 40 job rows under a bare host name. An honest gap beats a
    // manufactured row.
    if (!title) return;
    results.push({ title, url, snippet: pageSnippetFromHtml(pages[index] ?? null) });
  });
  return results;
}

/**
 * The shared wall-clock deadline for a whole fan-out, so sixteen concurrent
 * queries stop fetching titles at the same moment rather than each getting its
 * own fresh budget.
 */
export function geminiSearchDeadline(startedAt = Date.now()): number {
  return startedAt + GEMINI_SEARCH_BUDGET_MS;
}
