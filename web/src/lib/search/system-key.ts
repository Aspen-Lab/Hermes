/**
 * The one place `process.env.TAVILY_API_KEY` may be read.
 *
 * ABC-freemium 1-05 · R-KEY-3, R-POOL-3, R-ENT-4, and the key half of R-SEC-2.
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
 */

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
   * Where the **Tavily** key came from, which is the only thing R-METER-2
   * counts ("every system-Tavily search"). `"none"` means no Tavily key was
   * resolved, whether or not a Brave key exists. A BYOK search costs the
   * operator nothing, so attributing it would be noise.
   */
  provenance: "byok" | "system" | "none";
}

export function resolveSystemSearchKeys(
  input: SystemSearchKeyInput,
): SystemSearchKeys {
  const requestTavilyKey = input.requestTavilyKey?.trim();
  // Brave is env-only and D2 bans it on Vercel, so it can only exist on a
  // developer's machine. R-KEY-3 places it after the Tavily step, ungated.
  const brave = process.env.BRAVE_SEARCH_API_KEY || undefined;

  if (requestTavilyKey) {
    return { tavily: requestTavilyKey, brave, provenance: "byok" };
  }
  if (input.systemSearchAllowed && process.env.TAVILY_API_KEY) {
    return { tavily: process.env.TAVILY_API_KEY, brave, provenance: "system" };
  }
  return { brave, provenance: "none" };
}
