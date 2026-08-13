import { afterEach, describe, expect, it, vi } from "vitest";
import type { DailyForecastResult } from "../types";

const mocks = vi.hoisted(() => ({
  getDailyForecast: vi.fn(),
  maybeSingle: vi.fn(),
  profileRowToProfile: vi.fn(),
}));

vi.mock("./get-daily-forecast", async () => {
  const actual = await vi.importActual<typeof import("./get-daily-forecast")>(
    "./get-daily-forecast",
  );
  return { ...actual, getDailyForecast: mocks.getDailyForecast };
});
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mocks.maybeSingle }) }) }),
  }),
}));
vi.mock("@/app/api/profile/route", () => ({ profileRowToProfile: mocks.profileRowToProfile }));

import { openHome } from "./open-home";

const FORECAST: DailyForecastResult = {
  date: "2026-08-13",
  generatedAt: "2026-08-13T12:00:00.000Z",
  counts: { jobs: 1, papers: 0, events: 0, total: 1, shown: 1 },
  items: [],
};

afterEach(() => {
  vi.clearAllMocks();
});

// openHome has no pipeline logic of its own -- only parameter-shaping plus
// a small displayName attachment -- so this mocks getDailyForecast and the
// profile lookup directly rather than the underlying pipelines again
// (docs/handoff/MULTIAGENT-mcp-app.md §4 "Round 3 -- Agent B", item
// 3-02+3-13 test guidance).
describe("openHome", () => {
  it("requests the MAX_LIMIT ceiling (30) and no type filter for {}", async () => {
    mocks.getDailyForecast.mockResolvedValue(FORECAST);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await openHome("user-1", {});
    expect(mocks.getDailyForecast).toHaveBeenCalledWith("user-1", {
      type: undefined,
      limit: 30,
    });
    expect(result).toMatchObject(FORECAST);
  });

  it("passes a type filter through unchanged, still requesting the full ceiling", async () => {
    mocks.getDailyForecast.mockResolvedValue(FORECAST);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    await openHome("user-1", { type: "job" });
    expect(mocks.getDailyForecast).toHaveBeenCalledWith("user-1", {
      type: "job",
      limit: 30,
    });
  });

  it("attaches personaName from the profile's displayName when present", async () => {
    mocks.getDailyForecast.mockResolvedValue(FORECAST);
    mocks.maybeSingle.mockResolvedValue({ data: { user_id: "user-1" }, error: null });
    mocks.profileRowToProfile.mockReturnValue({ displayName: "mei.lin" });
    const result = await openHome("user-1");
    expect(result.personaName).toBe("mei.lin");
  });

  it("omits personaName (never a placeholder) when the profile has no display name", async () => {
    mocks.getDailyForecast.mockResolvedValue(FORECAST);
    mocks.maybeSingle.mockResolvedValue({ data: { user_id: "user-1" }, error: null });
    mocks.profileRowToProfile.mockReturnValue({ displayName: undefined });
    const result = await openHome("user-1");
    expect(result.personaName).toBeUndefined();
  });

  it("omits personaName when no profile row exists at all", async () => {
    mocks.getDailyForecast.mockResolvedValue(FORECAST);
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });
    const result = await openHome("user-1");
    expect(result.personaName).toBeUndefined();
  });
});
