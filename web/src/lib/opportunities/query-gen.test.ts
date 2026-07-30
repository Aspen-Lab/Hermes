import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveProvider } from "@/lib/llm/providers/registry";
import {
  generateSearchQueries,
  templateEventQueries,
  templateJobQueries,
} from "./query-gen";
import {
  EVENT_QUERY_BUDGET,
  JOB_INTERNSHIP_QUERY_BUDGET,
  JOB_QUERY_BUDGET,
} from "./query-budget";

vi.mock("@/lib/llm/providers/registry", () => ({
  resolveProvider: vi.fn(),
}));

afterEach(() => {
  vi.mocked(resolveProvider).mockReset();
});

const PROFILE = {
  topics: ["LCO", "topochemical", "ion exchange", "molten salt", "battery"],
  softTopics: [
    "electroplating",
    "molten salt electroplating",
    "solid state battery",
    "DFT matrix",
    "XRD",
    "Reliability (semiconductor)",
  ],
  careerStage: "PhD Year 3" as const,
};

describe("templateEventQueries", () => {
  it("puts specific required topics and a benchmark pair inside the adapter budget", () => {
    const year = new Date().getFullYear();
    const queries = templateEventQueries(PROFILE);
    const searched = queries.slice(0, EVENT_QUERY_BUDGET);

    expect(queries).toHaveLength(EVENT_QUERY_BUDGET);
    expect(queries[0]).not.toMatch(/^LCO\b/);
    expect(searched).toContain(`battery conference ${year}`);
    expect(searched).toContain(
      `battery solid state battery summit ${year}`,
    );
    expect(queries.some((query) => /\bsummit\b/i.test(query))).toBe(true);
    expect(queries.some((query) => /\bsymposium\b/i.test(query))).toBe(true);
    expect(queries.some((query) => /\bexpo forum congress\b/i.test(query))).toBe(
      true,
    );
    expect(queries.some((query) => /\bcareer fair\b/i.test(query))).toBe(true);
    expect(queries.some((query) => /\bjob fair\b/i.test(query))).toBe(true);
    expect(queries.some((query) => /\bhackathon\b/i.test(query))).toBe(true);
  });

  it("gives every required topic a query before adding lower-priority variants", () => {
    const searchedTopics = templateEventQueries(PROFILE).slice(0, PROFILE.topics.length);
    for (const topic of PROFILE.topics) {
      expect(
        searchedTopics.some((query) =>
          query.toLocaleLowerCase().startsWith(`${topic.toLocaleLowerCase()} `),
        ),
      ).toBe(true);
    }
  });

  it("covers every event vocabulary for each topic when the budget allows", () => {
    const year = new Date().getFullYear();
    const topics = ["solid state battery", "molten salt", "topochemical"];
    const queries = templateEventQueries({ topics });

    expect(queries).toHaveLength(15);
    for (const topic of topics) {
      expect(queries).toContain(`${topic} conference ${year}`);
      expect(queries).toContain(`${topic} summit ${year}`);
      expect(queries).toContain(`${topic} symposium ${year} call for papers`);
      expect(queries).toContain(`${topic} expo forum congress ${year}`);
    }
    expect(queries).toContain(`solid state battery career fair ${year}`);
    expect(queries).toContain(`molten salt job fair recruiting expo ${year}`);
    expect(queries).toContain(`topochemical hackathon ${year}`);
  });

  it("never exceeds the query cap for a long topic list", () => {
    const topics = Array.from({ length: 20 }, (_, index) => `topic ${index}`);
    expect(templateEventQueries({ topics })).toHaveLength(EVENT_QUERY_BUDGET);
    expect(templateJobQueries({ topics })).toHaveLength(JOB_QUERY_BUDGET);
  });
});

describe("templateJobQueries", () => {
  it("reserves all five internship phrasings for a PhD profile", () => {
    const queries = templateJobQueries(PROFILE);
    expect(queries).toHaveLength(JOB_QUERY_BUDGET);
    for (const topic of PROFILE.topics) {
      expect(
        queries.some((query) =>
          query.toLocaleLowerCase().startsWith(`${topic.toLocaleLowerCase()} `),
        ),
      ).toBe(true);
    }
    for (const phrase of [
      "research intern",
      "PhD intern",
      "co-op",
      "summer placement",
      "student researcher",
    ]) {
      expect(queries.some((query) => query.includes(phrase))).toBe(true);
    }
    expect(
      queries.filter((query) => /\bSummer \d{4}\b/.test(query)),
    ).toHaveLength(JOB_INTERNSHIP_QUERY_BUDGET);
  });

  it("cannot crowd the internship lane out with a long PhD topic list", () => {
    const queries = templateJobQueries({
      topics: Array.from({ length: 20 }, (_, index) => `topic ${index}`),
      careerStage: "PhD Year 6",
    });

    expect(queries).toHaveLength(JOB_QUERY_BUDGET);
    expect(
      queries.filter((query) => /\bSummer \d{4}\b/.test(query)),
    ).toHaveLength(JOB_INTERNSHIP_QUERY_BUDGET);
    expect(queries.some((query) => /\bco-op\b/i.test(query))).toBe(true);
    expect(queries.some((query) => /\bstudent researcher\b/i.test(query))).toBe(
      true,
    );
  });

  it("omits internship queries for a research scientist", () => {
    const queries = templateJobQueries({
      topics: ["solid state batteries", "electrochemistry"],
      careerStage: "Research Scientist",
    });

    expect(queries.join("\n")).not.toMatch(
      /\b(?:intern(?:ship)?s?|co[\s-]?op|summer placement|student researcher)\b/i,
    );
  });

  it("moves to the next summer cycle when the clock reaches July", () => {
    const july2026 = new Date(2026, 6, 1, 12).getTime();
    const queries = templateJobQueries(PROFILE, july2026).filter((query) =>
      /\bSummer \d{4}\b/.test(query),
    );

    expect(queries).toHaveLength(JOB_INTERNSHIP_QUERY_BUDGET);
    expect(queries.every((query) => query.endsWith("Summer 2027"))).toBe(true);
  });

  it("restores the reserved lane after Tier 2 query generation", async () => {
    vi.mocked(resolveProvider).mockReturnValue({
      id: "openai",
      generateDigest: vi.fn(),
      generateJsonText: vi.fn().mockResolvedValue(
        JSON.stringify(
          Array.from(
            { length: JOB_QUERY_BUDGET },
            (_, index) => `solid state battery scientist role ${index}`,
          ),
        ),
      ),
      testConnection: vi.fn(),
    });

    const queries = await generateSearchQueries(
      "jobs",
      {
        topics: ["solid state battery tier two lane"],
        careerStage: "PhD Year 2",
      },
      { provider: "openai", apiKey: "test-key" },
    );

    expect(queries).toHaveLength(JOB_QUERY_BUDGET);
    expect(
      queries.filter((query) => /\bSummer \d{4}\b/.test(query)),
    ).toHaveLength(JOB_INTERNSHIP_QUERY_BUDGET);
  });
});
