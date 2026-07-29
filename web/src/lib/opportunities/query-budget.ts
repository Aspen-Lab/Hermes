/**
 * Tavily's 1000-search monthly plan covers the whole product:
 * 16 Events + 12 Jobs + 4 Papers = 32/day, or 992 in a 31-day month.
 */
export const EVENT_QUERY_BUDGET = 16;
export const JOB_QUERY_BUDGET = 12;

/**
 * Results requested per search. Providers charge per search, not per result,
 * so this costs nothing extra and is the cheapest lever on pool size — the
 * facet panel can only offer locations that made it into the pool.
 */
export const RESULTS_PER_SEARCH = 10;
