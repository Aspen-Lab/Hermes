/**
 * Tavily's plan ceiling is roughly 33 searches/day across the whole product.
 * Daily opportunity pools allocate 18 to events and 12 to jobs (30 total),
 * leaving three searches/day, or about 100/month, as a safety reserve.
 */
export const EVENT_QUERY_BUDGET = 18;
export const JOB_QUERY_BUDGET = 12;
