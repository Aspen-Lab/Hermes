import { describe, expect, it, vi } from "vitest";
import type { DailyForecastResult } from "../types";

const mocks = vi.hoisted(() => ({
  getDailyForecast: vi.fn(),
}));

vi.mock("./get-daily-forecast", async () => {
  const actual = await vi.importActual<typeof import("./get-daily-forecast")>(
    "./get-daily-forecast",
  );
  return { ...actual, getDailyForecast: mocks.getDailyForecast };
});

import { openHome } from "./open-home";

const FORECAST: DailyForecastResult = {
  date: "2026-08-13",
  generatedAt: "2026-08-13T12:00:00.000Z",
  counts: { jobs: 1, papers: 0, events: 0, total: 1, shown: 1 },
  items: [],
};

// openHome has no pipeline logic of its own -- only parameter-shaping --
// so this mocks getDailyForecast directly rather than the underlying
// pipelines again (docs/handoff/MULTIAGENT-mcp-app.md §4 "Round 3 --
// Agent B", item 3-02+3-13 test guidance).
describe("openHome", () => {
  it("requests the MAX_LIMIT ceiling (30) and no type filter for {}", async () => {
    mocks.getDailyForecast.mockResolvedValue(FORECAST);
    const result = await openHome("user-1", {});
    expect(mocks.getDailyForecast).toHaveBeenCalledWith("user-1", {
      type: undefined,
      limit: 30,
    });
    expect(result).toBe(FORECAST);
  });

  it("passes a type filter through unchanged, still requesting the full ceiling", async () => {
    mocks.getDailyForecast.mockResolvedValue(FORECAST);
    await openHome("user-1", { type: "job" });
    expect(mocks.getDailyForecast).toHaveBeenCalledWith("user-1", {
      type: "job",
      limit: 30,
    });
  });

  it("returns exactly what getDailyForecast resolved to, unchanged", async () => {
    mocks.getDailyForecast.mockResolvedValue(FORECAST);
    const result = await openHome("user-1");
    expect(result).toStrictEqual(FORECAST);
  });
});
