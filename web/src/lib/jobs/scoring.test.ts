import { describe, it, expect } from "vitest";
import {
  isExpiredPosting,
  scoreCareerFit,
  scoreIndustryFit,
  scoreJobs,
} from "./scoring";
import { dedupJobs } from "./dedup";
import { remotiveJobToRawItem } from "./sources/remotive";
import { himalayasJobToRawItem } from "./sources/himalayas";
import {
  JOB_PATH_RE,
  NON_JOB_PATH_RE,
  webResultToRawJobItem,
} from "./sources/jobweb";
import type { RawJobItem } from "./types";
import { applyOpportunityFacetPreferenceSignal } from "@/lib/preferences/ledger";

function job(overrides: Partial<RawJobItem>): RawJobItem {
  return {
    id: "remotive:1",
    source: "remotive",
    title: "Research Scientist, Machine Learning",
    company: "Acme AI",
    location: "Remote",
    isRemote: true,
    description: "Work on machine learning research.",
    url: "https://example.com/job",
    tags: [],
    ...overrides,
  };
}

describe("scoreCareerFit", () => {
  it("ranks internships highest for early PhD students", () => {
    const intern = job({ title: "Research Intern, NLP" });
    const senior = job({ title: "Senior Staff Research Scientist" });
    expect(scoreCareerFit(intern, "PhD Year 2")).toBeGreaterThan(
      scoreCareerFit(senior, "PhD Year 2"),
    );
  });

  it("ranks postdoc and faculty roles highest for postdocs", () => {
    const postdoc = job({ title: "Postdoctoral Research Fellow" });
    const intern = job({ title: "PhD Internship" });
    expect(scoreCareerFit(postdoc, "Postdoc")).toBeGreaterThan(
      scoreCareerFit(intern, "Postdoc"),
    );
  });
});

describe("scoreIndustryFit", () => {
  it("prefers academic postings for academia-oriented users", () => {
    const academic = job({
      title: "Postdoc in Machine Learning",
      company: "Stanford University",
    });
    const corporate = job({ title: "ML Engineer", company: "Acme Corp" });
    expect(scoreIndustryFit(academic, "academia")).toBeGreaterThan(
      scoreIndustryFit(corporate, "academia"),
    );
    expect(scoreIndustryFit(corporate, "industry")).toBeGreaterThan(
      scoreIndustryFit(academic, "industry"),
    );
  });

  it("recognizes big tech companies", () => {
    const bigTech = job({ company: "DeepMind" });
    const other = job({ company: "Smallco" });
    expect(scoreIndustryFit(bigTech, "bigTech")).toBeGreaterThan(
      scoreIndustryFit(other, "bigTech"),
    );
  });

  it("does not classify every web-discovered job as academic", () => {
    const industryWebRole = job({
      source: "jobweb",
      title: "Battery R&D Scientist",
      company: "QuantumScape",
      description: "Develop commercial solid-state cells.",
    });
    const academicWebRole = job({
      source: "jobweb",
      title: "Postdoctoral Researcher",
      company: "State University",
    });
    expect(scoreIndustryFit(industryWebRole, "industry")).toBeGreaterThan(
      scoreIndustryFit(academicWebRole, "industry"),
    );
  });
});

describe("scoreJobs", () => {
  it("hard-gates postings that match neither topics nor methods", () => {
    const matching = job({ id: "a", title: "Machine Learning Research Scientist" });
    const unrelated = job({
      id: "b",
      title: "Accounts Payable Clerk",
      description: "Process invoices.",
    });
    const scored = scoreJobs([matching, unrelated], {
      topics: ["machine learning"],
    });
    expect(scored.map((s) => s.id)).toEqual(["a"]);
  });

  it("boosts location matches when preferences are set", () => {
    const local = job({ id: "a", location: "Boston, MA", isRemote: false });
    const elsewhere = job({ id: "b", location: "Sydney", isRemote: false });
    const scored = scoreJobs([local, elsewhere], {
      topics: ["machine learning"],
      locations: ["Boston"],
    });
    expect(scored[0].id).toBe("a");
  });

  it("produces a human-readable match reason", () => {
    const scored = scoreJobs([job({})], { topics: ["machine learning"] });
    expect(scored[0].matchReason.toLowerCase()).toContain("machine learning");
  });

  it("does not let a method-only web posting pass a battery required-topic gate", () => {
    const aiRole = job({
      id: "jobweb:ai",
      source: "jobweb",
      title: "Machine Learning Engineer",
      description: "Build AI systems.",
      tags: ["machine learning"],
    });
    expect(
      scoreJobs([aiRole], {
        topics: ["battery"],
        methods: ["machine learning"],
      }),
    ).toEqual([]);
  });

  it("keeps one scoped required match and uses an honest reason", () => {
    const batteryRole = job({
      id: "jobweb:battery",
      source: "jobweb",
      title: "Battery R&D Scientist",
      description: "Develop cells for electric vehicles.",
      tags: [],
    });
    const scored = scoreJobs([batteryRole], { topics: ["battery"] });
    expect(scored).toHaveLength(1);
    expect(scored[0].matchReason.toLowerCase()).toContain("battery");
    expect(scored[0].matchReason).not.toContain("Related to your research area");
  });

  it("requires two distinct full-text matches outside title and summary", () => {
    const prefix = "x".repeat(320);
    const oneBroadMatch = job({
      id: "jobweb:one",
      source: "jobweb",
      title: "Research Scientist",
      description: `${prefix} battery`,
      tags: [],
    });
    const twoBroadMatches = job({
      id: "jobweb:two",
      source: "jobweb",
      title: "Research Scientist",
      description: `${prefix} battery and molten salt`,
      tags: [],
    });
    const profile = { topics: ["battery", "molten salt"] };
    expect(scoreJobs([oneBroadMatch], profile)).toEqual([]);
    expect(scoreJobs([twoBroadMatches], profile)).toHaveLength(1);
  });

  it("does not allow explore-only or marketing-materials matches through", () => {
    const exploreOnly = job({
      id: "jobweb:explore",
      source: "jobweb",
      title: "Electroplating Specialist",
      description: "Run plating processes.",
      tags: [],
    });
    const marketing = job({
      id: "jobweb:marketing",
      source: "jobweb",
      title: "Marketing Coordinator",
      description: "Prepare marketing materials for product launches.",
      tags: [],
    });
    expect(
      scoreJobs([exploreOnly], {
        topics: ["battery"],
        softTopics: ["electroplating"],
      }),
    ).toEqual([]);
    expect(scoreJobs([marketing], { topics: ["materials"] })).toEqual([]);
  });

  it("applies a weak location-facet boost to the matching job", () => {
    const berlin = job({
      id: "berlin",
      location: "Berlin, Germany",
      place: { city: "Berlin", country: "Germany" },
      isRemote: false,
    });
    const chicago = job({
      id: "chicago",
      location: "Chicago, IL",
      place: {
        city: "Chicago",
        region: "IL",
        country: "United States",
      },
      isRemote: false,
    });
    const at = "2026-07-19T00:00:00.000Z";
    const preferenceLedger = applyOpportunityFacetPreferenceSignal(
      undefined,
      "location",
      "Chicago",
      { at, origin: "job" },
    );
    const ranked = scoreJobs(
      [berlin, chicago],
      { topics: ["machine learning"], preferenceLedger },
      Date.parse(at),
      { applyFloor: false },
    );

    expect(ranked[0].id).toBe("chicago");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
  });
});

describe("dedupJobs", () => {
  it("keeps the higher-priority source for the same title+company", () => {
    const fromWeb = job({
      id: "jobweb:x",
      source: "jobweb",
      title: "Research Scientist Machine Learning",
      company: "Acme AI",
    });
    const fromAdzuna = job({
      id: "adzuna:1",
      source: "adzuna",
      title: "Research Scientist, Machine Learning",
      company: "Acme AI",
    });
    const deduped = dedupJobs([fromWeb, fromAdzuna]);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].source).toBe("adzuna");
  });
});

describe("source mappers", () => {
  it("keeps real industry job pages and rejects article-shaped search results", () => {
    expect(JOB_PATH_RE.test("/careers/jobs/battery-rd-scientist")).toBe(true);
    expect(NON_JOB_PATH_RE.test("/articles/molten-salt-study")).toBe(true);

    expect(
      webResultToRawJobItem({
        title: "Battery R&D Scientist - QuantumScape",
        url: "https://careers.quantumscape.com/jobs/battery-rd-scientist",
        snippet: "Apply now to develop commercial solid-state cells.",
      }),
    ).toMatchObject({
      title: "Battery R&D Scientist",
      company: "QuantumScape",
    });
    expect(
      webResultToRawJobItem({
        title: "Evolution of micro-pores via molten salt dealloying",
        url: "https://www.nature.com/articles/example",
        snippet: "A Scientific Reports research article.",
      }),
    ).toBeNull();
  });

  it("rejects a generic web page with neither a job URL nor hiring language", () => {
    expect(
      webResultToRawJobItem({
        title: "Molten Salt Research Overview",
        url: "https://example.org/research/molten-salts",
        snippet: "A survey of recent scientific findings.",
      }),
    ).toBeNull();
  });

  it("maps a Remotive job and strips HTML", () => {
    const item = remotiveJobToRawItem({
      id: 42,
      url: "https://remotive.com/job/42",
      title: "ML Researcher",
      company_name: "Lab",
      category: "Data Science",
      tags: ["python"],
      publication_date: "2026-07-01T00:00:00Z",
      candidate_required_location: "Worldwide",
      description: "<p>Do <b>research</b> daily.</p>",
    });
    expect(item).not.toBeNull();
    expect(item!.id).toBe("remotive:42");
    expect(item!.description).toBe("Do research daily.");
    expect(item!.tags).toContain("Data Science");
  });

  it("maps a Himalayas job with location restrictions", () => {
    const item = himalayasJobToRawItem({
      title: "Research Engineer",
      companyName: "RemoteCo",
      locationRestrictions: ["United States"],
      categories: ["Machine-Learning"],
      description: "<ul><li>Train models</li></ul>",
      pubDate: 1784491534,
      applicationLink: "https://himalayas.app/companies/remoteco/jobs/re-1",
    });
    expect(item).not.toBeNull();
    expect(item!.location).toBe("Remote (United States)");
    expect(item!.tags).toContain("Machine Learning");
    expect(item!.postedAt).toBe(new Date(1784491534 * 1000).toISOString());
  });

  it("returns null for postings without a link", () => {
    expect(remotiveJobToRawItem({ id: 1, title: "X" })).toBeNull();
    expect(himalayasJobToRawItem({ title: "X" })).toBeNull();
  });
});

describe("expired postings", () => {
  const NOW = Date.parse("2026-07-26T00:00:00Z");

  function job(overrides: Partial<RawJobItem> = {}): RawJobItem {
    return {
      id: "jobweb:x",
      source: "jobweb",
      title: "Research Scientist",
      company: "Lab",
      location: "",
      isRemote: false,
      description: "",
      url: "https://example.test/job/1",
      tags: [],
      ...overrides,
    };
  }

  it("drops a posting whose season+year cycle has passed", () => {
    expect(
      isExpiredPosting(job({ title: "Molten Salt Chemistry Summer 2025 Internship" }), NOW),
    ).toBe(true);
  });

  it("keeps the current cycle", () => {
    expect(
      isExpiredPosting(job({ title: "Molten Salt Chemistry Summer 2026 Internship" }), NOW),
    ).toBe(false);
  });

  it("drops a posting older than the age limit", () => {
    expect(isExpiredPosting(job({ postedAt: "2025-01-01T00:00:00Z" }), NOW)).toBe(true);
  });

  it("keeps a recent posting", () => {
    expect(isExpiredPosting(job({ postedAt: "2026-07-01T00:00:00Z" }), NOW)).toBe(false);
  });

  it("keeps a posting with no date signal at all", () => {
    expect(isExpiredPosting(job(), NOW)).toBe(false);
  });
});
