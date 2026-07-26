import { describe, it, expect } from "vitest";
import {
  diversifyByType,
  MIN_SCORE,
  scoreEvents,
  scoreRank,
  scoreUrgency,
} from "./scoring";
import { dedupEvents } from "./dedup";
import { ccfConfToRawItem, parseCcfDateRange, parseCcfDeadline } from "./sources/ccfddl";
import {
  DENY_HOSTS,
  DENY_PATH_RE,
  extractDeadline,
  extractEventDate,
  guessEventType,
  webResultToRawEventItem,
} from "./sources/eventweb";
import type { RawEventItem, ScoredEventItem } from "./types";

const NOW = Date.parse("2026-07-19T00:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function iso(offsetDays: number): string {
  return new Date(NOW + offsetDays * DAY).toISOString();
}

function event(overrides: Partial<RawEventItem>): RawEventItem {
  return {
    id: "ccfddl:test",
    source: "ccfddl",
    name: "Machine Learning Conf 2026",
    type: "conference",
    startDate: iso(90),
    location: "Vienna, Austria",
    isOnline: false,
    description: "A conference on machine learning.",
    url: "https://example.com",
    tags: ["machine learning"],
    ...overrides,
  };
}

describe("scoreUrgency", () => {
  it("ranks a near deadline above a far one", () => {
    const near = event({ deadline: iso(20) });
    const far = event({ deadline: iso(150) });
    expect(scoreUrgency(near, NOW)).toBeGreaterThan(scoreUrgency(far, NOW));
  });

  it("falls back to event-start proximity when no deadline", () => {
    const soon = event({ startDate: iso(15), deadline: undefined });
    const distant = event({ startDate: iso(180), deadline: undefined });
    expect(scoreUrgency(soon, NOW)).toBeGreaterThan(scoreUrgency(distant, NOW));
  });
});

describe("scoreRank", () => {
  it("orders A* above B above unranked", () => {
    expect(scoreRank("CCF A · CORE A*")).toBeGreaterThan(scoreRank("CCF B"));
    expect(scoreRank("CCF B")).toBeGreaterThan(scoreRank(undefined));
  });
});

describe("scoreEvents", () => {
  it("drops fully-past events and keyword-gates the rest", () => {
    const past = event({ id: "a", startDate: iso(-30), deadline: undefined });
    const unrelated = event({
      id: "b",
      name: "Pottery Expo",
      description: "Clay and glaze.",
      tags: [],
    });
    const good = event({ id: "c" });
    const scored = scoreEvents([past, unrelated, good], {
      topics: ["machine learning"],
    });
    expect(scored.map((s) => s.id)).toEqual(["c"]);
  });

  it("keeps an event whose deadline passed but start date is upcoming", () => {
    const attendOnly = event({ id: "a", deadline: undefined, startDate: iso(40) });
    const scored = scoreEvents([attendOnly], { topics: ["machine learning"] });
    expect(scored).toHaveLength(1);
  });

  it("does not let a method-only AI conference pass a battery required-topic gate", () => {
    const aiConference = event({
      id: "eventweb:ai",
      source: "eventweb",
      name: "Artificial Intelligence Conference",
      startDate: "",
      description: "A machine learning research conference.",
      tags: ["machine learning"],
    });
    expect(
      scoreEvents([aiConference], {
        topics: ["battery"],
        methods: ["machine learning"],
      }),
    ).toEqual([]);
  });

  it("keeps a relevant date-less web event with one scoped required match", () => {
    const summit = event({
      id: "eventweb:battery",
      source: "eventweb",
      name: "Solid-State Battery Summit",
      startDate: "",
      description: "An industry conference in Chicago.",
      tags: [],
    });
    const scored = scoreEvents([summit], { topics: ["battery"] });
    expect(scored).toHaveLength(1);
    expect(scored[0].relevanceReason.toLowerCase()).toContain("battery");
    expect(scored[0].relevanceReason).not.toContain("Upcoming in your field");
  });

  it("requires two distinct full-text matches when title and summary do not match", () => {
    const prefix = "x".repeat(320);
    const oneBroadMatch = event({
      id: "eventweb:one",
      source: "eventweb",
      name: "Research Conference",
      startDate: "",
      description: `${prefix} battery`,
      tags: [],
    });
    const twoBroadMatches = event({
      id: "eventweb:two",
      source: "eventweb",
      name: "Research Conference",
      startDate: "",
      description: `${prefix} battery and molten salt`,
      tags: [],
    });
    const profile = { topics: ["battery", "molten salt"] };
    expect(scoreEvents([oneBroadMatch], profile)).toEqual([]);
    expect(scoreEvents([twoBroadMatches], profile)).toHaveLength(1);
  });

  it("does not allow an explore-only match through the required gate", () => {
    const exploreOnly = event({
      id: "eventweb:explore",
      source: "eventweb",
      name: "Electroplating Symposium",
      startDate: "",
      description: "A conference about electroplating.",
      tags: [],
    });
    expect(
      scoreEvents([exploreOnly], {
        topics: ["battery"],
        softTopics: ["electroplating"],
      }),
    ).toEqual([]);
  });

  it("applies the score floor after ranking", () => {
    const lowSignal = event({
      id: "low",
      source: "confstech",
      name: "General Conference",
      startDate: iso(300),
      description: "",
      tags: [],
    });
    const unfiltered = scoreEvents(
      [lowSignal],
      { topics: [] },
      NOW,
      { applyFloor: false },
    );
    expect(unfiltered).toHaveLength(1);
    expect(unfiltered[0].score).toBeLessThan(MIN_SCORE);
    expect(scoreEvents([lowSignal], { topics: [] }, NOW)).toEqual([]);
  });
});

describe("diversifyByType", () => {
  it("caps a single type and lets others through", () => {
    const items = [
      ...[1, 2, 3, 4].map((i) => ({ ...event({ id: `c${i}` }), score: 1 - i * 0.1 })),
      { ...event({ id: "s1", type: "seminar" as const }), score: 0.5 },
    ].map((e) => ({ ...e, matchedKeywords: [], relevanceReason: "" }) as ScoredEventItem);
    const out = diversifyByType(items, 3);
    expect(out.slice(0, 4).map((o) => o.id)).toEqual(["c1", "c2", "c3", "s1"]);
  });
});

describe("dedupEvents", () => {
  it("prefers ccfddl over web discovery for the same conference+year", () => {
    const web = event({
      id: "eventweb:x",
      source: "eventweb",
      name: "Machine Learning Conf 2026",
    });
    const curated = event({ id: "ccfddl:mlconf26" });
    const out = dedupEvents([web, curated]);
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("ccfddl");
  });
});

describe("ccfddl parsing", () => {
  it("parses date ranges spanning months", () => {
    const { start, end } = parseCcfDateRange("February 22 - March 1, 2027");
    expect(start!.slice(0, 10)).toBe("2027-02-22");
    expect(end!.slice(0, 10)).toBe("2027-03-01");
  });

  it("parses same-month day ranges", () => {
    const { start, end } = parseCcfDateRange("June 10-17, 2027");
    expect(start!.slice(0, 10)).toBe("2027-06-10");
    expect(end!.slice(0, 10)).toBe("2027-06-17");
  });

  it("treats TBD deadlines as absent", () => {
    expect(parseCcfDeadline("TBD")).toBeUndefined();
    expect(parseCcfDeadline("2027-08-15 23:59:59")).toBe(
      "2027-08-15T23:59:59.000Z",
    );
  });

  it("picks the newest upcoming edition and expands category tags", () => {
    const item = ccfConfToRawItem(
      {
        title: "AAAI",
        description: "AAAI Conference on Artificial Intelligence",
        sub: "AI",
        rank: { ccf: "A", core: "A*" },
        confs: [
          {
            year: 2025,
            id: "aaai25",
            date: "February 25 - March 4, 2025",
            place: "Philadelphia, USA",
            timeline: [{ deadline: "2024-08-15 23:59:59" }],
          },
          {
            year: 2027,
            id: "aaai27",
            link: "https://aaai.org",
            date: "January 20 - January 27, 2027",
            place: "Singapore",
            timeline: [{ deadline: "2026-08-15 23:59:59" }],
          },
        ],
      },
      NOW,
    );
    expect(item).not.toBeNull();
    expect(item!.id).toBe("ccfddl:aaai27");
    expect(item!.deadline).toBe("2026-08-15T23:59:59.000Z");
    expect(item!.rank).toBe("CCF A · CORE A*");
    expect(item!.tags).toContain("machine learning");
  });
});

describe("eventweb extraction", () => {
  it("exports the documented quality deny signals", () => {
    expect(DENY_HOSTS).toContain("instagram.com");
    expect(DENY_HOSTS).toContain("iopscience.iop.org");
    expect(DENY_HOSTS).toContain("waset.org");
    expect(DENY_PATH_RE.test("/article/example")).toBe(true);
    expect(DENY_PATH_RE.test("/events/example")).toBe(false);
  });

  it.each([
    "https://instagram.com/reel/example",
    "https://iopscience.iop.org/article/example",
    "https://subdomain.waset.org/conference/example",
    "https://example.org/doi/10.1000/example",
  ])("drops denied web result URL %s", (url) => {
    expect(
      webResultToRawEventItem(
        {
          title: "Solid-State Battery Summit 2026",
          url,
          snippet: "Conference on August 11, 2026 in Chicago",
        },
        NOW,
      ),
    ).toBeNull();
  });

  it("drops a dated result that does not have positive event shape", () => {
    expect(
      webResultToRawEventItem(
        {
          title: "Plasma-assisted surface modification of LCO cathodes",
          url: "https://example.org/research",
          snippet: "Published August 11, 2026",
        },
        NOW,
      ),
    ).toBeNull();
  });

  it("extracts month-day-year event dates", () => {
    expect(
      extractEventDate("MRS Fall Meeting, November 29 - December 4, 2026, Boston")!.slice(0, 10),
    ).toBe("2026-11-29");
  });

  it("extracts deadlines near deadline keywords", () => {
    expect(
      extractDeadline("Abstract submission deadline: August 14, 2026.")!.slice(0, 10),
    ).toBe("2026-08-14");
  });

  it("guesses event types", () => {
    expect(guessEventType("ICML Workshop on X")).toBe("workshop");
    expect(guessEventType("Weekly Colloquium")).toBe("seminar");
    expect(guessEventType("Annual Meeting")).toBe("conference");
  });

  it("drops event pages whose only year token is in the past", () => {
    expect(
      webResultToRawEventItem(
        { title: "Some Conference", url: "https://x.test", snippet: "held in 2019" },
        NOW,
      ),
    ).toBeNull();
  });

  it("drops non-event pages that carry no date", () => {
    expect(
      webResultToRawEventItem(
        { title: "A blog post about batteries", url: "https://x.test", snippet: "some article text" },
        NOW,
      ),
    ).toBeNull();
  });

  it("keeps a dated future event", () => {
    expect(
      webResultToRawEventItem(
        {
          title: "Materials Symposium",
          url: "https://x.test",
          snippet: "Join us September 14-18, 2026 in Berlin",
        },
        NOW,
      ),
    ).not.toBeNull();
  });

  it("keeps a date-less event page that reads as a conference (shown as TBA)", () => {
    const item = webResultToRawEventItem(
      {
        title: "International Battery Symposium",
        url: "https://x.test",
        snippet: "Annual call for papers — abstract submission now open",
      },
      NOW,
    );
    expect(item).not.toBeNull();
    expect(item?.startDate).toBe("");
  });

  it.each(["Battery Materials Expo", "Energy Storage Industry Forum"])(
    "keeps a date-less industry event shape: %s",
    (title) => {
      expect(
        webResultToRawEventItem(
          {
            title,
            url: "https://example.test/events/2026",
            snippet: "Registration and speakers announced",
          },
          NOW,
        ),
      ).not.toBeNull();
    },
  );
});
