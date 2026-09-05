/**
 * The one place any operator-funded **search** credential or capability may be
 * turned into "this reader may spend it".
 *
 * ABC-freemium 1-05 / 2-04 · R-KEY-3 (amended 2026-09-05), R-POOL-3, R-ENT-4,
 * and the key half of R-SEC-2 · Ruling 5 point 2 · Ruling 6 points 3–4.
 *
 * What was wrong: three readers, identical in shape, each `request key || env
 * key` — `jobs/sources/jobweb.ts`, `events/sources/eventweb.ts` and
 * `sources/web-search.ts`. Nothing in that path read `aiTier`, a session or an
 * entitlement, so a stranger with a `curl` and no account spent the operator's
 * search credits: seven outgoing searches on the events feed, two on jobs, from
 * an unauthenticated request that never entered the LLM branch the sign-in guard
 * sits in.
 *
 * It was also wider than it looked. `query.webSearch` is only shaped as
 * `{ tavilyApiKey }` when the user has the Tavily connector switched **on**;
 * with it switched off the old readers still fell through to the operator's key.
 * A user who deliberately turned the connector off was still spending it.
 *
 * ── THE DEFAULT IS `false`, AND THAT IS NOT A STYLE CHOICE ───────────────────
 *
 * `systemSearchAllowed` is passed in, never inferred, and every caller that does
 * not pass it gets `false`. Two pipelines run outside a user's own request —
 * `api/jobs/dispatch-digests` (the nightly cron, per enrolled user) and
 * `api/test-digest`. A default of `true` would hand the cron the operator's key
 * on behalf of every enrolled user, silently, at scale. That is D9's exact
 * nightmare, and it is the reason this reads a flag rather than an environment.
 *
 * ── WHAT THE FIELD SHOWS WHEN EVERY CANDIDATE IS REJECTED ────────────────────
 *
 * `{ provenance: "none" }` with no keys, which lands on plumbing that already
 * exists: `resolveSearchProvider` returns `null`, `fetchImpl` returns `[]`
 * (`jobweb.ts` / `eventweb.ts`, both `if (!provider) return [];`) and the
 * pipeline serves the structured sources it already has. That is R-POOL-3's
 * "jobs and events still respond from the free structured sources immediately",
 * and it is today's behaviour for a keyless user. **No error branch belongs
 * here.**
 *
 * ── 2-04: THE GATE COVERS FOUR PROVIDERS, NOT ONE ────────────────────────────
 *
 * Round 2 found the same defect three more times. Only the system Tavily key
 * was behind `systemSearchAllowed`; **Brave, Vertex AI Search and Gemini
 * grounding were all read straight from the environment**, so on any runtime
 * where one of those names is set, an anonymous caller spent the operator's
 * search budget with no gate, no breaker and no usage row. Ruling 5 point 2
 * makes them one mechanism:
 *
 *  - one predicate — `systemSearchAllowed && <the credential exists>`;
 *  - one breaker — the 500/day cap, charged for **any** of the four;
 *  - one usage row — carrying the provider's **name**, not a hard-coded
 *    `"tavily"`.
 *
 * **The gate goes on the AVAILABILITY INPUTS, and that is load-bearing.**
 * Rewriting the auto preference order alone closes nothing: for jobs and events
 * the pipeline sets an explicit `provider` from the server's own environment, so
 * `resolveWebSearchProvider` returns from its explicit branch before any
 * ordering clause runs. Both branches read the same `availability` object, so
 * gating that object closes both at once.
 *
 * ── WHAT IS DELIBERATELY *NOT* HERE ──────────────────────────────────────────
 *
 * **Adzuna, JSearch and USAJobs** (Ruling 6 point 4). They read
 * `request key || operator env key` in the same shape, but they are the free
 * structured backbone of the jobs surface and their keys buy free-tier quota
 * rather than per-call billing. Gating them would kill the free product's jobs
 * sources. They stay env-only, bounded by the existing per-user hourly buckets,
 * and they are **not** on the build guard's ban list either. **Threshold:** if
 * any of the three ever starts billing per request, it joins this mechanism the
 * same round.
 */

import { isGeminiSearchAvailable } from "@/lib/sources/gemini-search";
import { isVertexSearchAvailable } from "@/lib/sources/vertex-search";

export interface SystemSearchKeyInput {
  /** The user's own Tavily key, from `query.webSearch.tavilyApiKey`. */
  requestTavilyKey?: string;
  /**
   * From `entitlement.systemSearchAllowed` — never from a request body, and
   * never defaulted to `true`. D2: trial and paid only.
   */
  systemSearchAllowed: boolean;
}

export interface SystemSearchKeys {
  tavily?: string;
  brave?: string;
  /**
   * Where the **Tavily** key came from. `"none"` means no Tavily key was
   * resolved, whether or not a Brave key exists. A BYOK search costs the
   * operator nothing, so attributing it would be noise.
   *
   * **Its meaning is deliberately NOT widened to "the chosen provider's
   * provenance"** (2-04). Doing that would need the provider to be known before
   * the keys are resolved, which reverses the call order at all three adapters.
   * `isOperatorFundedSearch` below mixes the two facts at the one point of use
   * instead.
   */
  provenance: "byok" | "system" | "none";
}

export function resolveSystemSearchKeys(
  input: SystemSearchKeyInput,
): SystemSearchKeys {
  const requestTavilyKey = input.requestTavilyKey?.trim();
  // 2-04 — Brave is now behind the SAME gate as the system Tavily key. It used
  // to be read unconditionally and handed back on every branch, including
  // `provenance: "none"`, so an anonymous caller on a machine with
  // `BRAVE_SEARCH_API_KEY` set spent the operator's Brave credits. Gating it at
  // the env read makes `braveKeyPresent` correct at all three call sites with
  // no change to any of them.
  const brave = input.systemSearchAllowed
    ? process.env.BRAVE_SEARCH_API_KEY || undefined
    : undefined;

  if (requestTavilyKey) {
    return { tavily: requestTavilyKey, brave, provenance: "byok" };
  }
  if (input.systemSearchAllowed && process.env.TAVILY_API_KEY) {
    return { tavily: process.env.TAVILY_API_KEY, brave, provenance: "system" };
  }
  return { brave, provenance: "none" };
}

/**
 * Whether this reader may spend the operator's Vertex project on search.
 *
 * Vertex AI Search and Gemini grounding are **capabilities rather than keys** —
 * their availability is "is a project configured", not "did a key resolve" — so
 * they cannot ride on `SystemSearchKeys`. They ride here instead, behind the
 * identical predicate, so that "who may spend the operator's search money" is
 * answered for all four providers in this one file.
 *
 * Three copies of `systemSearchAllowed && isXAvailable()` at three adapters is
 * how the fourth call site forgets; this is the one copy.
 */
export function operatorSearchAvailability(input: {
  systemSearchAllowed: boolean;
}): { geminiAvailable: boolean; vertexAvailable: boolean } {
  if (!input.systemSearchAllowed) {
    return { geminiAvailable: false, vertexAvailable: false };
  }
  return {
    geminiAvailable: isGeminiSearchAvailable(),
    vertexAvailable: isVertexSearchAvailable(),
  };
}

/**
 * True when the search that is about to run is billed to the **operator**
 * rather than to the reader — so it must be charged to the 500/day breaker and
 * must write an R-METER-2 row naming the provider.
 *
 * Brave, Vertex and grounding are **always** operator-funded: there is no BYOK
 * path to any of them (`searchConnectors` carries only a Tavily key, and
 * `SystemSearchKeys` has no Brave request field). Tavily is the only provider
 * with two possible payers, which is what `provenance` records.
 */
export function isOperatorFundedSearch(
  provider: "tavily" | "brave" | "vertex" | "gemini",
  keys: Pick<SystemSearchKeys, "provenance">,
): boolean {
  return provider === "tavily" ? keys.provenance === "system" : true;
}
