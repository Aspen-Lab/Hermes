import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { PaperReport } from "@/lib/papers/report";

const mocks = vi.hoisted(() => ({
  resolveProvider: vi.fn(),
  generateDeepReport: vi.fn(),
  buildPaywalledFallback: vi.fn(),
  bindFiguresToReport: vi.fn(),
  getFullText: vi.fn(),
  getFigurePool: vi.fn(),
}));

// ABC-freemium 1-06 — the routes now ask the registry whether the request
// carries a usable BYOK override, so the metering wrapper can attribute the
// call. The mock must export it or the module has a hole where a real function
// used to be.
vi.mock("@/lib/llm/providers/registry", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/llm/providers/registry")>();
  return { ...actual, resolveProvider: mocks.resolveProvider };
});
vi.mock("@/lib/papers/deep-report", () => ({
  generateDeepReport: mocks.generateDeepReport,
  buildPaywalledFallback: mocks.buildPaywalledFallback,
}));
vi.mock("@/lib/papers/figure-binding", () => ({
  bindFiguresToReport: mocks.bindFiguresToReport,
}));
vi.mock("@/lib/papers/full-text", () => ({
  getFullText: mocks.getFullText,
}));
vi.mock("@/lib/figures/extract", () => ({
  getFigurePool: mocks.getFigurePool,
}));

import { POST } from "./route";
import {
  InMemoryCounterStore,
  deepReportDayKey,
  endOfUtcDay,
  getCounterStore,
  resetCounterStoreForTests,
} from "@/lib/usage/counters";
import { PAID_DEEP_REPORTS_PER_DAY } from "@/lib/usage/deep-report-quota";
import type { ReportStreamEvent } from "@/lib/papers/report-stream";

const paper = {
  id: "arxiv:2607.00001",
  title: "A focused paper",
  authors: ["A. Researcher"],
  relevanceReason: "Matches the declared topic.",
  venue: "Peer Review",
  source: "arxiv" as const,
  summaryIntro: "This paper studies a focused research question.",
  summaryExperimentKeywords: ["focused method"],
  summaryResultDiscussion: "The experiment supports the stated conclusion.",
  isSaved: false,
};

const generatedReport: PaperReport = {
  whatItProposes: {
    summary: "A generated proposal summary.",
    methods: ["A focused method."],
  },
  resultsAndSignificance: {
    summary: "A generated result summary.",
    keyResults: [
      {
        title: "Main result",
        detail: "The main generated result.",
        figureIndex: 1,
      },
    ],
  },
  whyItFitsYou: {
    reasons: ["It fits the declared topic."],
    keywords: ["focused method"],
  },
  depth: "deep",
};

function request(
  body: Record<string, unknown>,
  accept = "application/x-ndjson",
): NextRequest {
  return new NextRequest("http://localhost/api/papers/report", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: accept,
    },
    body: JSON.stringify(body),
  });
}

async function readEvents(response: Response): Promise<ReportStreamEvent[]> {
  return (await response.text())
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as ReportStreamEvent);
}

beforeEach(() => {
  // ABC-freemium 1-20 — the counter store is memoised per module, so without
  // this every test in the file spends the same monthly deep-report budget and
  // the sixth one is refused. Resetting it is what keeps each case independent.
  resetCounterStoreForTests();
  vi.clearAllMocks();
});

describe("POST /api/papers/report streaming", () => {
  it("emits Tier 0 mode first and performs no report-generation work", async () => {
    mocks.resolveProvider.mockReturnValue(null);

    const response = await POST(request({ paper }));
    const events = await readEvents(response);

    expect(response.headers.get("content-type")).toContain(
      "application/x-ndjson",
    );
    expect(response.headers.get("cache-control")).toBe("no-store, no-transform");
    expect(events).toEqual([
      { type: "mode", aiMode: "tier0" },
      {
        type: "stage",
        stage: "done",
        label: "Basic report ready",
        pct: 100,
      },
    ]);
    expect(mocks.getFullText).not.toHaveBeenCalled();
    expect(mocks.generateDeepReport).not.toHaveBeenCalled();
    expect(mocks.getFigurePool).not.toHaveBeenCalled();
    expect(mocks.bindFiguresToReport).not.toHaveBeenCalled();
  });

  it("keeps Tier 1 shallow and makes exactly one model call", async () => {
    const generateJsonText = vi.fn().mockResolvedValue(
      JSON.stringify({
        ...generatedReport,
        depth: "abstract",
      }),
    );
    mocks.resolveProvider.mockReturnValue({ generateJsonText });

    const response = await POST(
      request(
        { paper, stream: true },
        "application/json",
      ),
    );
    const events = await readEvents(response);

    expect(events.map((event) => event.type)).toEqual([
      "mode",
      "stage",
      "report",
      "stage",
    ]);
    expect(events[0]).toEqual({ type: "mode", aiMode: "tier1" });
    // The shallow path has one real step, so it emits a single low anchor and
    // lets the client ease forward. Emitting a second high stage up front
    // would slam the bar across before any work happened, then strand it.
    expect(
      events
        .filter((event) => event.type === "stage")
        .map((event) => event.pct),
    ).toEqual([20, 100]);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
    expect(mocks.getFullText).not.toHaveBeenCalled();
    expect(mocks.generateDeepReport).not.toHaveBeenCalled();
    expect(mocks.getFigurePool).not.toHaveBeenCalled();
    expect(mocks.bindFiguresToReport).not.toHaveBeenCalled();
  });

  it("reuses each existing Tier 2 operation once and emits monotonic stages", async () => {
    const generateJsonText = vi.fn();
    const provider = { generateJsonText };
    const doc = {
      title: paper.title,
      source: "ar5iv",
      sections: [{ heading: "Results", text: "Body text" }],
      figureCaptions: [],
      rawText: "Body text",
    };
    mocks.resolveProvider.mockReturnValue(provider);
    mocks.getFullText.mockResolvedValue({
      status: "ok",
      doc,
      attempts: [],
    });
    mocks.getFigurePool.mockResolvedValue(null);
    mocks.generateDeepReport.mockResolvedValue(generatedReport);
    mocks.bindFiguresToReport.mockResolvedValue(generatedReport);

    const response = await POST(
      request({ paper, deepReport: true }),
    );
    const events = await readEvents(response);

    expect(events.map((event) => event.type)).toEqual([
      "mode",
      "stage",
      "stage",
      "stage",
      "stage",
      "report",
      "stage",
    ]);
    expect(events[0]).toEqual({ type: "mode", aiMode: "tier2" });
    expect(
      events
        .filter((event) => event.type === "stage")
        .map((event) => event.pct),
    ).toEqual([10, 35, 75, 92, 100]);
    expect(mocks.getFullText).toHaveBeenCalledTimes(1);
    expect(mocks.generateDeepReport).toHaveBeenCalledTimes(1);
    expect(mocks.getFigurePool).toHaveBeenCalledTimes(1);
    expect(mocks.bindFiguresToReport).toHaveBeenCalledTimes(1);
    expect(generateJsonText).not.toHaveBeenCalled();
  });
});

describe("POST /api/papers/report JSON fallback", () => {
  it("preserves the non-streaming JSON response", async () => {
    const generateJsonText = vi.fn().mockResolvedValue(
      JSON.stringify({
        ...generatedReport,
        depth: "abstract",
      }),
    );
    mocks.resolveProvider.mockReturnValue({ generateJsonText });

    const response = await POST(
      request({ paper }, "application/json"),
    );
    const report = (await response.json()) as PaperReport;

    expect(response.headers.get("content-type")).toContain("application/json");
    expect(report.whatItProposes.summary).toBe(
      generatedReport.whatItProposes.summary,
    );
    expect(generateJsonText).toHaveBeenCalledTimes(1);
    expect(mocks.getFullText).not.toHaveBeenCalled();
  });
});

/**
 * ABC-freemium 3-03 · R-QUOTA-1 · R-QUOTA-3 · Ruling 9 points 1-3.
 *
 * ── THE RULE THIS SUITE EXISTS FOR ───────────────────────────────────────────
 *
 * **Drive the request shape the app actually sends, and assert the check RAN.**
 * Every earlier test of this route's quota passed while a deep papers report
 * skipped the counter entirely, because they asserted where the counter sat in
 * the file and round-3 A drove the route without the NDJSON header. The route
 * answered honestly on the path it was asked about; the app takes the other one.
 * `lib/papers/report-stream.ts` sends `Accept: application/x-ndjson` on **every**
 * request, so that header is not an option here — it is the product.
 *
 * The counter is observed directly, by spying on the store's `increment`, rather
 * than inferred from the response. A response can look identical whether or not
 * anything was counted; that is exactly how this shipped.
 */
describe("POST /api/papers/report — the quota is REACHABLE on the streamed shape (3-03)", () => {
  /** The deep request the papers page builds, verbatim in shape. */
  const deepBody = { paper, deepReport: true };

  function spyOnCounter() {
    // Spied on the class rather than the module: `getCounterStore()` memoises,
    // and the route resolves its own store inside the request.
    return vi.spyOn(InMemoryCounterStore.prototype, "increment");
  }

  /** Only the deep-report keys; the rate-limit key shares the same store. */
  function deepKeys(spy: ReturnType<typeof spyOnCounter>): string[] {
    return spy.mock.calls
      .map(([key]) => String(key))
      .filter((key) => key.startsWith("deep:"));
  }

  /**
   * The one runtime in which a route test can hold a PAID entitlement.
   *
   * `isLocalDevRuntime()` is deliberately false under `NODE_ENV=test`, so the
   * default here is the no-sign-in-configured branch: user `local-no-auth`,
   * plan `free`, budget 5. `PEER_DEV_ENTITLEMENT` is only read on the
   * local-development branch, which is why stubbing it alone does nothing —
   * a real finding from writing this suite, and the reason the free cases below
   * stub nothing at all.
   */
  function asPaidDeveloper() {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("PEER_DEV_ENTITLEMENT", "paid");
    // That branch synthesises its own user id, so the counter keys are this one.
    return "dev-local";
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  beforeEach(() => {
    const generateJsonText = vi
      .fn()
      .mockResolvedValue(JSON.stringify(generatedReport));
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    mocks.getFullText.mockResolvedValue({ status: "ok", doc: { text: "Body." } });
    mocks.getFigurePool.mockResolvedValue(null);
    mocks.generateDeepReport.mockResolvedValue(generatedReport);
    mocks.bindFiguresToReport.mockImplementation((report: PaperReport) => report);
  });

  it("counts a STREAMED deep report — the case that shipped uncounted", async () => {
    // Before 3-03 this assertion failed: `wantsStream` returned above the only
    // `consumeDeepReport` call, so the deep read ran, fetched full text, wrote a
    // tier-2 report, and decremented nothing.
    const increments = spyOnCounter();

    const response = await POST(request(deepBody));
    const events = await readEvents(response);

    expect(events.map((event) => event.type)).toContain("report");
    expect(events).toContainEqual({ type: "mode", aiMode: "tier2" });
    expect(deepKeys(increments)).toHaveLength(1);
  });

  it("carries the quota signal in the STREAM once the monthly allowance is gone", async () => {
    // The free allowance is 5 a month across papers + jobs + events (D4). The
    // sixth streamed deep request must come back refused — and the refusal has
    // to survive the streamed transport, which is the half 2-07 could not build
    // because no refusal ever reached the stream.
    for (let i = 0; i < 5; i += 1) {
      await readEvents(await POST(request(deepBody)));
    }

    const events = await readEvents(await POST(request(deepBody)));
    const quota = events.find((event) => event.type === "quota");

    expect(quota).toEqual({
      type: "quota",
      quota: expect.objectContaining({
        kind: "deep_report",
        reason: "exhausted",
        remaining: 0,
      }),
    });
  });

  it("puts the quota event BEFORE the mode event, and still delivers a report", async () => {
    // Two properties in one case, because they are one requirement. The client
    // rejects a stream that does not open with `mode` and returns early on
    // `tier0`, so a refusal placed after the mode event is dropped for exactly
    // the reader it is for. And "never a heading over nothing": the reader keeps
    // the complete deterministic report — the notice sits beside it.
    for (let i = 0; i < 5; i += 1) {
      await readEvents(await POST(request(deepBody)));
    }
    // The five priming requests are real deep reads and DO call it; the
    // assertion below is about the sixth.
    mocks.generateDeepReport.mockClear();

    const events = await readEvents(await POST(request(deepBody)));
    const types = events.map((event) => event.type);

    expect(types.indexOf("quota")).toBe(0);
    expect(types).toContain("report");
    // Degraded to the shallow depth, exactly as the non-streamed branch does on
    // a refusal — not an error, and not a tier-2 read on a spent allowance.
    expect(events).toContainEqual({ type: "mode", aiMode: "tier1" });
    expect(mocks.generateDeepReport).not.toHaveBeenCalled();
  });

  it("charges the paid 200/day breaker on the streamed path too", async () => {
    // R-QUOTA-2 · D4 — a paid reader is unlimited *to the reader* and capped to
    // protect the operator's wallet. On papers that cap never fired at all: the
    // breaker charge rides along with the same counter call the stream skipped,
    // so the operator's own spend ceiling was absent on this surface.
    const userId = asPaidDeveloper();
    const increments = spyOnCounter();

    await readEvents(await POST(request(deepBody)));

    // The paid path charges the DAY key, not the month key.
    expect(deepKeys(increments)).toHaveLength(1);
    expect(deepKeys(increments)[0]).toBe(
      deepReportDayKey(userId, new Date()),
    );
  });

  it("refuses a paid reader past the daily breaker, in the stream", async () => {
    const userId = asPaidDeveloper();
    // Charge the breaker to its cap directly rather than driving 200 requests:
    // the route and the helper share one store and one key, which is the point
    // of D4's "one counter" and is asserted by `deep-report-quota.test.ts`.
    const store = getCounterStore();
    const now = new Date();
    for (let i = 0; i < PAID_DEEP_REPORTS_PER_DAY; i += 1) {
      await store.increment(
        deepReportDayKey(userId, now),
        endOfUtcDay(now),
        1,
        now,
      );
    }

    const events = await readEvents(await POST(request(deepBody)));
    const quota = events.find((event) => event.type === "quota");

    expect(quota).toEqual({
      type: "quota",
      quota: expect.objectContaining({ kind: "breaker", reason: "exhausted" }),
    });
    expect(mocks.generateDeepReport).not.toHaveBeenCalled();
  });

  it("does NOT count a SHALLOW streamed request — R-QUOTA-3's real exemption", async () => {
    // Ruling 9 point 1: the exemption is a DEPTH, not a transport. This is the
    // mirror case that stops the fix over-correcting: if a shallow stream began
    // counting, every abstract-only read would spend a deep report, which breaks
    // R-QUOTA-3 for real and would be a worse defect than the one being fixed.
    const increments = spyOnCounter();

    const events = await readEvents(await POST(request({ paper })));

    expect(events).toContainEqual({ type: "mode", aiMode: "tier1" });
    expect(deepKeys(increments)).toEqual([]);
    expect(events.some((event) => event.type === "quota")).toBe(false);
  });

  it("does not count TWICE — one call site, whichever transport is used", async () => {
    // Ruling 9 point 2 names the opposite failure: a second `consumeDeepReport`
    // inside `streamReport` would also make both transports count, and would
    // charge a reader twice for one report.
    const increments = spyOnCounter();

    await readEvents(await POST(request(deepBody)));
    const afterStream = deepKeys(increments).length;

    await POST(request(deepBody, "application/json")).then((r) => r.json());

    expect(afterStream).toBe(1);
    expect(deepKeys(increments)).toHaveLength(2);
  });
});
