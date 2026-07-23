import { describe, it, expect } from "vitest";
import { scoreCareerFit, scoreIndustryFit, scoreJobs } from "./scoring";
import { dedupJobs } from "./dedup";
import { remotiveJobToRawItem } from "./sources/remotive";
import { himalayasJobToRawItem } from "./sources/himalayas";
import type { RawJobItem } from "./types";

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
