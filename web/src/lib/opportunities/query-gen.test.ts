import { describe, expect, it } from "vitest";
import { templateEventQueries, templateJobQueries } from "./query-gen";
import {
  EVENT_QUERY_BUDGET,
  JOB_QUERY_BUDGET,
} from "./query-budget";

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

    expect(queries).toHaveLength(12);
    for (const topic of topics) {
      expect(queries).toContain(`${topic} conference ${year}`);
      expect(queries).toContain(`${topic} summit ${year}`);
      expect(queries).toContain(`${topic} symposium ${year} call for papers`);
      expect(queries).toContain(`${topic} expo forum congress ${year}`);
    }
  });

  it("never exceeds the query cap for a long topic list", () => {
    const topics = Array.from({ length: 20 }, (_, index) => `topic ${index}`);
    expect(templateEventQueries({ topics })).toHaveLength(EVENT_QUERY_BUDGET);
    expect(templateJobQueries({ topics })).toHaveLength(JOB_QUERY_BUDGET);
  });
});

describe("templateJobQueries", () => {
  it("uses every required topic and keeps role terms within the expanded budget", () => {
    const queries = templateJobQueries(PROFILE);
    expect(queries.length).toBeLessThanOrEqual(JOB_QUERY_BUDGET);
    for (const topic of PROFILE.topics) {
      expect(
        queries.some((query) =>
          query.toLocaleLowerCase().startsWith(`${topic.toLocaleLowerCase()} `),
        ),
      ).toBe(true);
    }
    expect(queries.every((query) => /research intern|PhD internship/.test(query))).toBe(
      true,
    );
  });
});
