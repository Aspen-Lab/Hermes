import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  PAID_DEEP_REPORTS_PER_DAY,
  consumeDeepReport,
  quotaMessage,
} from "./deep-report-quota";
import {
  SYSTEM_SEARCHES_PER_DAY,
  consumeSystemSearches,
} from "./search-breaker";
import { getCounterStore, resetCounterStoreForTests } from "./counters";
import { setUsageEventsClientForTests, type UsageEventRow } from "./events";
import { ANONYMOUS_ENTITLEMENT, type Entitlement } from "@/lib/entitlement/types";

/**
 * ABC-freemium 1-23 · R-QUOTA-1, R-QUOTA-2, R-QUOTA-3, D4, R-TEST-1.
 *
 * **The clock is stubbed, never `Date.now()`.** `resetsAt` is a claim about a
 * calendar boundary, and a test that computed it the same way the code does
 * would assert nothing.
 */

const NOW = new Date("2026-09-04T12:00:00.000Z");

const rows: UsageEventRow[] = [];

function entitlement(overrides: Partial<Entitlement>): Entitlement {
  return { ...ANONYMOUS_ENTITLEMENT, userId: "user-1", ...overrides };
}

const FREE = entitlement({
  plan: "free",
  effectivePlan: "free",
  deepReportsRemaining: 5,
});
const TRIAL = entitlement({
  plan: "trial",
  effectivePlan: "trial",
  deepReportsRemaining: 20,
  trialEndsAt: "2026-09-18T00:00:00.000Z",
});
const PAID = entitlement({
  plan: "paid",
  effectivePlan: "paid",
  deepReportsRemaining: Number.POSITIVE_INFINITY,
});

beforeEach(() => {
  rows.length = 0;
  resetCounterStoreForTests();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
  setUsageEventsClientForTests({
    from: () => ({
      insert: (inserted: UsageEventRow[]) => {
        rows.push(...inserted);
        return Promise.resolve({ error: null });
      },
    }),
  } as never);
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  setUsageEventsClientForTests(undefined);
  resetCounterStoreForTests();
});

describe("free monthly quota (R-QUOTA-1, D4)", () => {
  it("allows five and refuses the sixth", async () => {
    for (let i = 1; i <= 5; i += 1) {
      const decision = await consumeDeepReport(FREE, NOW);
      expect(decision.allowed, `report ${i}`).toBe(true);
      expect(decision.quota).toBeUndefined();
    }

    const sixth = await consumeDeepReport(FREE, NOW);

    expect(sixth.allowed).toBe(false);
    expect(sixth.quota).toEqual({
      kind: "deep_report",
      remaining: 0,
      // First instant of the next UTC month, asserted against a stubbed clock.
      resetsAt: "2026-10-01T00:00:00.000Z",
    });
  });

  it("draws papers, jobs and events from ONE counter (D4)", async () => {
    // Three separate counters is the easy accident, and it would give a free
    // reader fifteen deep reports instead of five. Nothing about these calls
    // names a surface, which is the point: the budget is the reader's.
    for (let i = 0; i < 5; i += 1) await consumeDeepReport(FREE, NOW);

    expect((await consumeDeepReport(FREE, NOW)).allowed).toBe(false);
  });

  it("starts again in the next calendar month", async () => {
    for (let i = 0; i < 6; i += 1) await consumeDeepReport(FREE, NOW);

    const october = new Date("2026-10-01T00:00:00.000Z");
    expect((await consumeDeepReport(FREE, october)).allowed).toBe(true);
  });
});

describe("trial cap (R-QUOTA-2, D4)", () => {
  it("allows twenty over the whole trial and refuses the twenty-first", async () => {
    for (let i = 0; i < 20; i += 1) {
      expect((await consumeDeepReport(TRIAL, NOW)).allowed).toBe(true);
    }

    const decision = await consumeDeepReport(TRIAL, NOW);

    expect(decision.allowed).toBe(false);
    // NOT the next month: a trial's twenty do not come back monthly. What
    // changes is the plan, at the trial's end.
    expect(decision.quota?.resetsAt).toBe("2026-09-18T00:00:00.000Z");
  });

  it("does NOT reset at a month boundary", async () => {
    // The trial key carries no period segment on purpose. A later reader will
    // want to make it monthly for symmetry; this is what stops them.
    for (let i = 0; i < 20; i += 1) await consumeDeepReport(TRIAL, NOW);

    const october = new Date("2026-10-01T00:00:00.000Z");
    expect((await consumeDeepReport(TRIAL, october)).allowed).toBe(false);
  });

  it("an expired trial falls to the FREE budget, not the trial one", async () => {
    // D5 — expiry is computed at read time, so `effectivePlan` is already
    // `free` here and `deepReportsRemaining` is five.
    const expired = entitlement({
      plan: "trial",
      effectivePlan: "free",
      deepReportsRemaining: 5,
      trialEndsAt: null,
    });

    for (let i = 0; i < 5; i += 1) {
      expect((await consumeDeepReport(expired, NOW)).allowed).toBe(true);
    }
    expect((await consumeDeepReport(expired, NOW)).allowed).toBe(false);
  });
});

describe("paid breaker (R-QUOTA-2, D4)", () => {
  it("is unlimited to the reader until the daily cap", async () => {
    const store = getCounterStore();
    // Pre-spend the day to one below the cap rather than making 200 calls.
    await store.increment(
      `deep:${PAID.userId}:2026-09-04`,
      null,
      PAID_DEEP_REPORTS_PER_DAY - 1,
    );

    expect((await consumeDeepReport(PAID, NOW)).allowed).toBe(true);

    const overCap = await consumeDeepReport(PAID, NOW);

    expect(overCap.allowed).toBe(false);
    expect(overCap.quota).toEqual({
      kind: "breaker",
      remaining: 0,
      resetsAt: "2026-09-05T00:00:00.000Z",
    });
  });

  it("writes exactly one breaker row and one error line per trip", async () => {
    const store = getCounterStore();
    await store.increment(
      `deep:${PAID.userId}:2026-09-04`,
      null,
      PAID_DEEP_REPORTS_PER_DAY,
    );

    await consumeDeepReport(PAID, NOW);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "user-1",
      kind: "breaker",
      path: "deep-report",
      ok: false,
    });
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  it("untrips on the next UTC day, with no extra state", async () => {
    const store = getCounterStore();
    await store.increment(
      `deep:${PAID.userId}:2026-09-04`,
      null,
      PAID_DEEP_REPORTS_PER_DAY,
    );
    expect((await consumeDeepReport(PAID, NOW)).allowed).toBe(false);

    const tomorrow = new Date("2026-09-05T00:00:01.000Z");
    expect((await consumeDeepReport(PAID, tomorrow)).allowed).toBe(true);
  });
});

describe("the system-search breaker (R-QUOTA-2)", () => {
  it("allows the day's searches and refuses the one past the cap", async () => {
    expect(
      await consumeSystemSearches("user-1", SYSTEM_SEARCHES_PER_DAY, NOW),
    ).toBe(true);

    expect(await consumeSystemSearches("user-1", 1, NOW)).toBe(false);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "breaker", path: "system-search" });
  });

  it("charges the whole fan-out, not one per call", async () => {
    // A fan-out of twelve queries costs twelve, or the 500/day cap would mean
    // 500 fan-outs rather than 500 searches.
    await consumeSystemSearches("user-1", SYSTEM_SEARCHES_PER_DAY - 5, NOW);

    expect(await consumeSystemSearches("user-1", 12, NOW)).toBe(false);
  });
});

describe("the two failure directions", () => {
  it("fails CLOSED when the counter store is unreachable", async () => {
    // A deep-report allowance is a spend cap, so it takes the breaker's
    // direction. The reader still gets a complete deterministic report.
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "SERVICE-ROLE-NOT-A-KEY");
    resetCounterStoreForTests();

    // No admin client can be built from that URL in this process, so every
    // increment reports not-ok.
    const decision = await consumeDeepReport(FREE, NOW);

    expect(decision.allowed).toBe(false);
    expect(decision.quota?.kind).toBe("deep_report");
  });
});

describe("quotaMessage (R-QUOTA-1, Ruling 3 point 1)", () => {
  it("is the English string the ruling names", () => {
    expect(
      quotaMessage(
        {
          kind: "deep_report",
          remaining: 0,
          resetsAt: "2026-10-01T00:00:00.000Z",
        },
        NOW,
      ),
    ).toBe("You've used this month's deep reports. Resets in 27 days.");
  });

  it("says the day count in singular when it is one", () => {
    expect(
      quotaMessage(
        {
          kind: "deep_report",
          remaining: 0,
          resetsAt: "2026-09-05T00:00:00.000Z",
        },
        NOW,
      ),
    ).toContain("Resets in 1 day.");
  });

  it("contains no CJK characters", () => {
    // The product is English-only; the spec's original Chinese was the
    // manager's shorthand (Ruling 3 point 1).
    const message = quotaMessage(
      { kind: "breaker", remaining: 0, resetsAt: "2026-09-05T00:00:00.000Z" },
      NOW,
    );
    expect(/[一-鿿]/.test(message)).toBe(false);
  });
});
