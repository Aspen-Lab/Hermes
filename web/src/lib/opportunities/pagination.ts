export const OPPORTUNITY_PAGE_SIZE = 10;

interface RankedOpportunity {
  relevanceScore?: number;
}

export interface OpportunityPage<TItem> {
  items: TItem[];
  remaining: number;
  total: number;
}

export function paginateOpportunities<TItem extends RankedOpportunity>(
  items: TItem[],
  visibleCount?: number,
): OpportunityPage<TItem>;
export function paginateOpportunities<TItem>(
  items: TItem[],
  visibleCount: number,
  scoreOf: (item: TItem) => number,
): OpportunityPage<TItem>;
export function paginateOpportunities<TItem>(
  items: TItem[],
  visibleCount = OPPORTUNITY_PAGE_SIZE,
  scoreOf?: (item: TItem) => number,
): OpportunityPage<TItem> {
  const readScore =
    scoreOf ??
    ((item: TItem) =>
      ((item as RankedOpportunity).relevanceScore ?? 0));
  const sorted = [...items].sort(
    (left, right) => readScore(right) - readScore(left),
  );
  const safeVisibleCount = Math.max(
    OPPORTUNITY_PAGE_SIZE,
    Math.floor(visibleCount),
  );
  const visible = sorted.slice(0, safeVisibleCount);
  return {
    items: visible,
    remaining: Math.max(0, sorted.length - visible.length),
    total: sorted.length,
  };
}

export function nextOpportunityPageSize(
  visibleCount: number,
  total: number,
): number {
  return Math.min(
    Math.max(0, total),
    Math.max(OPPORTUNITY_PAGE_SIZE, visibleCount) + OPPORTUNITY_PAGE_SIZE,
  );
}
