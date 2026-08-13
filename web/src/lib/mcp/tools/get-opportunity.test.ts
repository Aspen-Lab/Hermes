import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  maybeSingle: vi.fn(),
  profileRowToProfile: vi.fn(),
  runJobsPipeline: vi.fn(),
  runEventsPipeline: vi.fn(),
  fetchPaperById: vi.fn(),
  rawItemToPaper: vi.fn(),
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

vi.mock("@/lib/jobs/pipeline", () => ({
  runJobsPipeline: mocks.runJobsPipeline,
}));

vi.mock("@/lib/events/pipeline", () => ({
  runEventsPipeline: mocks.runEventsPipeline,
}));

vi.mock("@/lib/papers/fetch-by-id", () => ({
  fetchPaperById: mocks.fetchPaperById,
}));

vi.mock("@/lib/feed/mapper", () => ({
  rawItemToPaper: mocks.rawItemToPaper,
}));

import { getOpportunity } from "./get-opportunity";

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

const PAPER_A = {
  id: "arxiv:2508.00001",
  title: "Paper A",
  authors: [],
  relevanceReason: "r",
  venue: "arXiv",
  source: "arxiv",
  summaryIntro: "",
  summaryExperimentKeywords: [],
  summaryResultDiscussion: "",
  isSaved: false,
  relevanceScore: 0.7,
  linkPaper: "https://arxiv.org/abs/2508.00001",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.maybeSingle.mockResolvedValue({ data: PROFILE_ROW, error: null });
  mocks.rawItemToPaper.mockImplementation(() => PAPER_A);
});

describe("getOpportunity — job prefix", () => {
  it("finds a match in the full scored pool (not just topN items)", async () => {
    stubProfile();
    mocks.runJobsPipeline.mockResolvedValue({
      items: [], // deliberately empty -- proves the lookup reads `.pool`, not `.items`
      pool: [JOB_A],
      facetCounts: {},
      meta: {},
    });

    const result = await getOpportunity("u1", { id: "remotive:a" });

    expect(result).toMatchObject({ type: "job", id: "remotive:a", title: "Job A" });
  });

  it("returns structured not-found for a stale/rotated pool id", async () => {
    stubProfile();
    mocks.runJobsPipeline.mockResolvedValue({ items: [], pool: [], facetCounts: {}, meta: {} });

    const result = await getOpportunity("u1", { id: "remotive:gone" });

    expect(result).toEqual({ found: false, id: "remotive:gone" });
  });

  it("returns not-found without calling the pipeline when researchTopics is empty", async () => {
    stubProfile({ researchTopics: [] });

    const result = await getOpportunity("u1", { id: "remotive:a" });

    expect(result).toEqual({ found: false, id: "remotive:a" });
    expect(mocks.runJobsPipeline).not.toHaveBeenCalled();
  });

  it("returns not-found when no profile row exists for the user", async () => {
    mocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getOpportunity("unknown-user", { id: "remotive:a" });

    expect(result).toEqual({ found: false, id: "remotive:a" });
    expect(mocks.runJobsPipeline).not.toHaveBeenCalled();
  });
});

describe("getOpportunity — event prefix", () => {
  it("finds a match in the full scored pool", async () => {
    stubProfile();
    mocks.runEventsPipeline.mockResolvedValue({
      items: [],
      pool: [EVENT_A],
      facetCounts: {},
      meta: {},
    });

    const result = await getOpportunity("u1", { id: "ccfddl:a" });

    expect(result).toMatchObject({ type: "event", id: "ccfddl:a", title: "Event A" });
  });
});

describe("getOpportunity — paper prefixes (RULING 6)", () => {
  it("resolves an arxiv: id via fetchPaperById + rawItemToPaper", async () => {
    mocks.fetchPaperById.mockResolvedValue({ id: "arxiv:2508.00001", source: "arxiv" });

    const result = await getOpportunity("u1", { id: "arxiv:2508.00001" });

    expect(mocks.fetchPaperById).toHaveBeenCalledWith("arxiv:2508.00001");
    expect(result).toMatchObject({ type: "paper", id: "arxiv:2508.00001" });
    // Never fabricated -- no location/deadline key on a paper item.
    expect("location" in (result as object)).toBe(false);
    expect("deadline" in (result as object)).toBe(false);
  });

  it("resolves an openalex: id via fetchPaperById + rawItemToPaper", async () => {
    mocks.fetchPaperById.mockResolvedValue({ id: "openalex:W123", source: "openalex" });

    const result = await getOpportunity("u1", { id: "openalex:W123" });

    expect(mocks.fetchPaperById).toHaveBeenCalledWith("openalex:W123");
    expect(result).toMatchObject({ type: "paper" });
  });

  it("returns structured not-found when fetchPaperById can't resolve an arxiv/openalex id", async () => {
    mocks.fetchPaperById.mockResolvedValue(null);

    const result = await getOpportunity("u1", { id: "arxiv:does-not-exist" });

    expect(result).toEqual({ found: false, id: "arxiv:does-not-exist" });
  });

  it.each(["semantic_scholar", "dblp", "pubmed", "web", "hn"])(
    "never calls fetchPaperById for the unresolvable %s: prefix -- structured not-found only",
    async (source) => {
      const id = `${source}:some-id`;
      const result = await getOpportunity("u1", { id });

      expect(result).toEqual({ found: false, id });
      expect(mocks.fetchPaperById).not.toHaveBeenCalled();
    },
  );
});

describe("getOpportunity — unrecognized id", () => {
  it("returns structured not-found for a prefix that matches nothing", async () => {
    const result = await getOpportunity("u1", { id: "totally-unknown:xyz" });
    expect(result).toEqual({ found: false, id: "totally-unknown:xyz" });
  });
});
