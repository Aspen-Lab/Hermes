import { describe, expect, it } from "vitest";
import {
  nextOpportunityPageSize,
  OPPORTUNITY_PAGE_SIZE,
  paginateOpportunities,
} from "./pagination";

function rankedScores(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `item-${index}`,
    relevanceScore: ((index * 7) % count) / count,
  }));
}

describe("opportunity pagination", () => {
  it("shows 10 ranked items first without mutating the pool", () => {
    const pool = rankedScores(25);
    const originalOrder = pool.map(({ id }) => id);

    const page = paginateOpportunities(pool);

    expect(page.items).toHaveLength(OPPORTUNITY_PAGE_SIZE);
    expect(page.remaining).toBe(15);
    expect(page.total).toBe(25);
    expect(page.items.map(({ relevanceScore }) => relevanceScore)).toEqual(
      [...page.items]
        .map(({ relevanceScore }) => relevanceScore)
        .sort((left, right) => (right ?? 0) - (left ?? 0)),
    );
    expect(pool.map(({ id }) => id)).toEqual(originalOrder);
  });

  it("appends the next 10 and clamps the final page to the pool size", () => {
    const pool = rankedScores(25);
    const secondPageSize = nextOpportunityPageSize(10, pool.length);
    const secondPage = paginateOpportunities(pool, secondPageSize);
    const finalPageSize = nextOpportunityPageSize(
      secondPage.items.length,
      pool.length,
    );
    const finalPage = paginateOpportunities(pool, finalPageSize);

    expect(secondPage.items).toHaveLength(20);
    expect(secondPage.remaining).toBe(5);
    expect(finalPageSize).toBe(25);
    expect(finalPage.items).toHaveLength(25);
    expect(finalPage.remaining).toBe(0);
    expect(finalPage.items.slice(0, 20)).toEqual(secondPage.items);
  });
});
