export const FEED_TYPES = ["dashboard", "papers", "events", "jobs"] as const;

export type FeedType = (typeof FEED_TYPES)[number];

export function feedTypeFromSearchParams(
  searchParams: Pick<URLSearchParams, "get">,
): FeedType {
  const tab = searchParams.get("tab");
  return FEED_TYPES.includes(tab as FeedType) ? (tab as FeedType) : "dashboard";
}
