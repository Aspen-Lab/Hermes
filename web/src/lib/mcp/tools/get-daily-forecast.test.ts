import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  profileRowToProfile: vi.fn(),
  runFeedPipeline: vi.fn(),
  runJobsPipeline: vi.fn(),
  runEventsPipeline: vi.fn(),
  scoredItemToPaper: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: mocks.maybeSingle,
        }),
      }),
    }),
  }),
}));

vi.mock("@/app/api/profile/route", () => ({
  profileRowToProfile: mocks.profileRowToProfile,
}));

vi.mock("@/lib/feed/pipeline", () => ({
  runFeedPipeline: mocks.runFeedPipeline,
}));

vi.mock("@/lib/jobs/pipeline", () => ({
  runJobsPipeline: mocks.runJobsPipeline,
}));

vi.mock("@/lib/events/pipeline", () => ({
  runEventsPipeline: mocks.runEventsPipeline,
}));

// scoredItemToPaper normally reshapes a ScoredItem into a Paper; here the
// papers-lane fixtures are already Paper-shaped, so the mock is an identity
// pass-through — paperToForecastItem (the real, unmocked function under
// test transitively) is what actually exercises RULING 4's field rules.
vi.mock("@/lib/feed/mapper", () => ({
  scoredItemToPaper: mocks.scoredItemToPaper,
}));

import { getDailyForecast } from "./get-daily-forecast";

const PROFILE_ROW = { user_id: "u1" };

function stubProfile(overrides: Record<string, unknown> = {}) {
  mocks.profileRowToProfile.mockReturnValue({
    researchTopics: ["machine learning"],
    careerStage: "PhD Year 3",
    industryVsAcademia: "unsure",
    locationPreferences: ["Remote"],
    authorisedCountries: ["US"],
    ...overrides,
  });
}

const PAPER_A = {
  id: "arxiv:a",
  title: "Paper A",
  authors: [],
  relevanceReason: "r",
  venue: "arXiv",
  source: "arxiv",
  summaryIntro: "",
  summaryExperimentKeywords: [],
  summaryResultDiscussion: "",
  isSaved: false,
  relevanceScore: 0.5,
  linkPaper: "https://arxiv.org/a",
};

const JOB_A = {
  id: "remotive:a",
  roleTitle: "Job A",
  companyOrLab: "Co",
  location: "Remote",
  isRemote: true,
  keyRequirements: [],
  matchReason: "m",
  relevanceScore: 0.9,
  linkPosting: "https://x/a",
};

const EVENT_A = {
  id: "ccfddl:a",
  name: "Event A",
  type: "conference",
  date: "2027-01-01",
  location: "X",
  isOnline: false,
  shortDescription: "",
  relevanceReason: "r",
  relevanceScore: 0.3,
};

function feedResponse(items: unknown[]) {
  return { items, meta: {} };
}
function jobsResponse(items: unknown[]) {
  return { items, pool: items, facetCounts: {}, meta: {} };
}
function eventsResponse(items: unknown[]) {
  return { items, pool: items, facetCounts: {}, meta: {} };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maybeSingle.mockResolvedValue({ data: PROFILE_ROW, error: null });
  mocks.scoredItemToPaper.mockImplementation((x: unknown) => x);
});

describe("getDailyForecast", () => {
  it("merges and sorts all three lanes by relevance descending", async () => {
    stubProfile();
    mocks.runFeedPipeline.mockResolvedValue(feedResponse([PAPER_A]));
    mocks.runJobsPipeline.mockResolvedValue(jobsResponse([JOB_A]));
    mocks.runEventsPipeline.mockResolvedValue(eventsResponse([EVENT_A]));

    const result = await getDailyForecast("u1");

    expect(result.items.map((i) => i.id)).toEqual([JOB_A.id, PAPER_A.id, EVENT_A.id]);
  });

  it("never renders a location or deadline key on a mapped paper item (RULING 4)", async () => {
    stubProfile();
    mocks.runFeedPipeline.mockResolvedValue(feedResponse([PAPER_A]));
    mocks.runJobsPipeline.mockResolvedValue(jobsResponse([]));
    mocks.runEventsPipeline.mockResolvedValue(eventsResponse([]));

    const result = await getDailyForecast("u1");
    const paperItem = result.items.find((i) => i.type === "paper")!;

    expect(paperItem).toBeTruthy();
    expect("location" in paperItem).toBe(false);
    expect("deadline" in paperItem).toBe(false);
  });

  it("passes aiTier: 0 to all three pipeline calls (1-11 Tier-0 guarantee)", async () => {
    stubProfile();
    mocks.runFeedPipeline.mockResolvedValue(feedResponse([]));
    mocks.runJobsPipeline.mockResolvedValue(jobsResponse([]));
    mocks.runEventsPipeline.mockResolvedValue(eventsResponse([]));

    await getDailyForecast("u1");

    expect(mocks.runFeedPipeline).toHaveBeenCalledWith(expect.objectContaining({ aiTier: 0 }));
    expect(mocks.runJobsPipeline).toHaveBeenCalledWith(expect.objectContaining({ aiTier: 0 }));
    expect(mocks.runEventsPipeline).toHaveBeenCalledWith(expect.objectContaining({ aiTier: 0 }));
  });

  it("short-circuits to an empty forecast when researchTopics is empty, calling no pipeline", async () => {
    stubProfile({ researchTopics: [] });

    const result = await getDailyForecast("u1");

    expect(result).toEqual({
      date: expect.any(String),
      generatedAt: expect.any(String),
      counts: { jobs: 0, papers: 0, events: 0, total: 0, shown: 0 },
      items: [],
    });
    expect(mocks.runFeedPipeline).not.toHaveBeenCalled();
    expect(mocks.runJobsPipeline).not.toHaveBeenCalled();
    expect(mocks.runEventsPipeline).not.toHaveBeenCalled();
  });

  it("returns an empty forecast when no profile row exists for the user", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getDailyForecast("unknown-user");

    expect(result.items).toEqual([]);
    expect(mocks.profileRowToProfile).not.toHaveBeenCalled();
    expect(mocks.runFeedPipeline).not.toHaveBeenCalled();
  });

  it("only fetches the requested lane when `type` is set", async () => {
    stubProfile();
    mocks.runJobsPipeline.mockResolvedValue(jobsResponse([JOB_A]));

    const result = await getDailyForecast("u1", { type: "job" });

    expect(mocks.runFeedPipeline).not.toHaveBeenCalled();
    expect(mocks.runEventsPipeline).not.toHaveBeenCalled();
    expect(mocks.runJobsPipeline).toHaveBeenCalled();
    expect(result.items).toHaveLength(1);
    expect(result.items[0].type).toBe("job");
  });

  it("counts reflect the full merged pool; shown reflects the limit-sliced result", async () => {
    stubProfile();
    mocks.runFeedPipeline.mockResolvedValue(feedResponse([PAPER_A]));
    mocks.runJobsPipeline.mockResolvedValue(jobsResponse([JOB_A]));
    mocks.runEventsPipeline.mockResolvedValue(eventsResponse([EVENT_A]));

    const result = await getDailyForecast("u1", { limit: 2 });

    expect(result.counts).toEqual({ jobs: 1, papers: 1, events: 1, total: 3, shown: 2 });
    expect(result.items).toHaveLength(2);
  });

  it("keeps other lanes' items when one pipeline call rejects", async () => {
    stubProfile();
    mocks.runFeedPipeline.mockRejectedValue(new Error("papers source down"));
    mocks.runJobsPipeline.mockResolvedValue(jobsResponse([JOB_A]));
    mocks.runEventsPipeline.mockResolvedValue(eventsResponse([EVENT_A]));

    const result = await getDailyForecast("u1");

    expect(result.items.map((i) => i.type).sort()).toEqual(["event", "job"]);
  });

  it("defaults limit to 9 and caps an oversized request at 30", async () => {
    stubProfile();
    mocks.runFeedPipeline.mockResolvedValue(feedResponse([]));
    mocks.runJobsPipeline.mockResolvedValue(jobsResponse([]));
    mocks.runEventsPipeline.mockResolvedValue(eventsResponse([]));

    await getDailyForecast("u1");
    expect(mocks.runJobsPipeline).toHaveBeenCalledWith(expect.objectContaining({ topN: 9 }));

    vi.clearAllMocks();
    mocks.maybeSingle.mockResolvedValue({ data: PROFILE_ROW, error: null });
    mocks.scoredItemToPaper.mockImplementation((x: unknown) => x);
    stubProfile();
    mocks.runFeedPipeline.mockResolvedValue(feedResponse([]));
    mocks.runJobsPipeline.mockResolvedValue(jobsResponse([]));
    mocks.runEventsPipeline.mockResolvedValue(eventsResponse([]));

    await getDailyForecast("u1", { limit: 999 });
    expect(mocks.runJobsPipeline).toHaveBeenCalledWith(expect.objectContaining({ topN: 30 }));
  });
});
