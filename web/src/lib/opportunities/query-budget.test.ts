import { afterEach, describe, expect, it, vi } from "vitest";
import { eventweb } from "@/lib/events/sources/eventweb";
import { jobweb } from "@/lib/jobs/sources/jobweb";
import {
  EVENT_QUERY_BUDGET,
  JOB_QUERY_BUDGET,
} from "./query-budget";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("daily opportunity search budgets", () => {
  it("executes at most 18 event searches", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await eventweb.fetch({
      topics: ["battery"],
      queries: Array.from({ length: 30 }, (_, index) => `event query ${index}`),
      limit: 80,
      webSearch: { tavilyApiKey: "test-key" },
    });

    expect(EVENT_QUERY_BUDGET).toBe(18);
    expect(fetchSpy).toHaveBeenCalledTimes(EVENT_QUERY_BUDGET);
  });

  it("executes at most 12 job searches", async () => {
    const fetchSpy = vi.fn(async () =>
      new Response(JSON.stringify({ results: [] }), {
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await jobweb.fetch({
      topics: ["battery"],
      queries: Array.from({ length: 30 }, (_, index) => `job query ${index}`),
      locations: [],
      limit: 60,
      webSearch: { tavilyApiKey: "test-key" },
    });

    expect(JOB_QUERY_BUDGET).toBe(12);
    expect(fetchSpy).toHaveBeenCalledTimes(JOB_QUERY_BUDGET);
  });
});
