import { describe, it, expect } from "vitest";
import {
  isExpiredPosting,
  isNonJobArticle,
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
    // B2-08 / Ruling 12. Plate 02's "Why Peer sent this to you" reads as one
    // flowing sentence. job({}) matches the topic and is remote, so this
    // fixture produces two clauses — enough to prove they join with "and",
    // not the old " · ".
    expect(scored[0].matchReason.toLowerCase()).toContain(
      "focus and remote-friendly",
    );
    expect(scored[0].matchReason).not.toContain(" · ");
  });

  // ══════════════════════════════════════════════════════════════════════════
  // A25-01 / A22-03(b) / RULING 68b — THE REASON LINE'S REMOTE CLAUSE.
  //
  // A22-03(b) drew the render boundary at `mapper.ts`: a `jobweb` row's
  // `isRemote` is set at ingestion from a page-scoped search SNIPPET, which can
  // carry a NEIGHBOURING posting's text, so that row does not get to make a
  // remote claim to the reader. Round 25 A then measured the claim reaching the
  // reader anyway at a SIXTH consumer — the deep report's "Why Peer sent this
  // to you" line, which is assembled HERE at scoring time from the raw flag.
  // Live on `lensa.com`, 5 of 5, byte-identical in the rendered markup: the
  // line read `… and remote-friendly` on a posting whose own provider title
  // says `job in Albuquerque`, while the same page's location and work-mode
  // surfaces correctly rendered no `Remote` at all.
  //
  // The four cases below are all ADDITIONS. **The pre-existing assertion above
  // ("focus and remote-friendly") is a free must-keep lock for this fix** — its
  // fixture is `source: "remotive"`, so it stays green and catches an
  // over-gating that silences the honest sources.
  // ══════════════════════════════════════════════════════════════════════════
  it("drops the remote clause from a jobweb reason line without moving the score", () => {
    const base = {
      id: "jobweb:1",
      source: "jobweb" as const,
      location: "Albuquerque, NM",
      url: "https://lensa.com/job",
    };
    const now = Date.parse("2026-08-15T00:00:00Z");
    const profile = { topics: ["machine learning"], locations: ["Boston"] };
    const [remote] = scoreJobs([job({ ...base })], profile, now);
    const [notRemote] = scoreJobs(
      [job({ ...base, isRemote: false })],
      profile,
      now,
    );

    // (1) THE CLAIM IS GONE, and the existing two-clause join collapses to the
    // one-clause sentence rather than inventing any replacement text.
    expect(remote.matchReason).toBe("Matches your machine learning focus");
    expect(remote.matchReason).not.toContain("remote-friendly");

    // (2) THE SCORE DID NOT MOVE. Both numbers were measured on the REVERTED
    // source before this fix landed and are byte-identical after it: `score` is
    // finished at the top of the push and `reasonFor` is called inside the same
    // object literal, with nothing reading the returned string back.
    expect(remote.score).toBe(0.7545560085694348);
    expect(notRemote.score).toBe(0.7230560085694349);

    // (3) THE RAW FLAG STILL FEEDS THE SCORE, which is the boundary this fix
    // must NOT cross: `locationFit(item.location, item.isRemote, …)` is
    // A22-03(b)'s deliberate raw reader. If a later change gates at INGESTION
    // or at `locationFit` instead of here, these two collapse to one number and
    // this line goes red.
    expect(remote.score).not.toBe(notRemote.score);
  });

  it("keeps the remote clause on sources that own the flag", () => {
    const now = Date.parse("2026-08-15T00:00:00Z");
    const profile = { topics: ["machine learning"], locations: ["Boston"] };
    // `remotive.ts` and `himalayas.ts` hard-code `isRemote: true` from the
    // source's own structured record. The gate is on the SOURCE, not on the
    // flag, and these are the rows that prove it did not over-reach.
    for (const source of ["remotive", "himalayas", "adzuna"] as const) {
      const [scored] = scoreJobs(
        [job({ id: `${source}:1`, source, location: "Albuquerque, NM" })],
        profile,
        now,
      );
      expect(`${source}: ${scored.matchReason}`).toBe(
        `${source}: Matches your machine learning focus and remote-friendly`,
      );
    }
  });

  it("falls back to the web-search wording when the remote clause was the only reason", () => {
    // **THE REACHABLE EDGE round 25 B named so C would lock it rather than
    // discover it.** When the clause was the row's ONLY reason, dropping it
    // empties `parts` and the PRE-EXISTING empty-parts fallback fires instead.
    // Measured on the reverted source, this exact row read `Remote-friendly` —
    // the rejected claim standing alone as the whole sentence. It now reads
    // `Matched by web search`, which is existing text, invents nothing, and
    // reinserts nothing (Ruling 26 satisfied).
    const now = Date.parse("2026-08-15T00:00:00Z");
    const barista = {
      title: "Barista",
      description: "Make coffee.",
      location: "Albuquerque, NM",
    };
    // `applyFloor: false` because a reason-less row scores below the floor and
    // would otherwise be dropped before it could be read.
    const [web] = scoreJobs(
      [job({ id: "jobweb:1", source: "jobweb", ...barista })],
      { topics: [] },
      now,
      { applyFloor: false },
    );
    expect(web.matchReason).toBe("Matched by web search");
    expect(web.score).toBe(0.325);

    // THE ADMITTED CONTROL: the identical shape on a source that owns the flag
    // still produces the standalone `Remote-friendly` sentence, so this case
    // is proving the SOURCE gate and not merely the empty-parts fallback.
    const [owned] = scoreJobs(
      [job({ id: "remotive:9", source: "remotive", ...barista })],
      { topics: [] },
      now,
      { applyFloor: false },
    );
    expect(owned.matchReason).toBe("Remote-friendly");
    expect(owned.score).toBe(0.332);
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
    expect(ranked[0].facetPreferenceReason).toBeUndefined();
  });

  it("explains a facet boost only when it materially changes job rank", () => {
    const candidates = [
      ["berlin", "Berlin"],
      ["boston", "Boston"],
      ["austin", "Austin"],
      ["chicago", "Chicago"],
    ].map(([id, city]) =>
      job({
        id,
        location: `${city}, Test`,
        place: { city },
        isRemote: false,
      }),
    );
    const at = "2026-07-19T00:00:00.000Z";
    const preferenceLedger = applyOpportunityFacetPreferenceSignal(
      undefined,
      "location",
      "Chicago",
      { at, origin: "job" },
    );
    const ranked = scoreJobs(
      candidates,
      { topics: ["machine learning"], preferenceLedger },
      Date.parse(at),
      { applyFloor: false },
    );

    expect(ranked[0].id).toBe("chicago");
    expect(ranked[0].facetPreferenceReason).toBe(
      "Because you often view Chicago",
    );
    expect(
      ranked.slice(1).every(
        (item) => item.facetPreferenceReason === undefined,
      ),
    ).toBe(true);
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

    // B8-02 (round 8) changed this from company: "QuantumScape" to
    // company: undefined. This fixture predates looksLikeHostBrand
    // (B5-03, round 5) entirely and was never revisited against it; it
    // happened to keep passing only because the pre-B8-02 guard checked
    // just the FIRST DNS label ("careers"), never the second ("quantumscape").
    // B8-02 fixed a confirmed live bug where a platform's own brand on a
    // subdomain (talents.vaia.com -> "Vaia") leaked through as if it were
    // the employer, by checking every label instead of only the first.
    // That is the identical shape to this fixture: careers.quantumscape.com
    // also has its brand-like label second, one position deeper than the
    // pre-fix check looked. There is no way to tell "a platform's brand
    // hosted for other employers" apart from "a real employer's own name
    // on their own careers subdomain" from host structure alone - both are
    // "candidate equals a domain label" - and looksLikeHostBrand's own
    // long-standing doc comment already accepts that exact-equal costs a
    // rare real company name in exchange for catching many more job-board/
    // platform-brand leaks (see shared.test.ts's "Climatebase" case, same
    // rule, unchanged, since round 5). Silence here is the guard doing its
    // job, not a new default - flagged in §4 for the next real-data pass to
    // check how often "careers.<company>.<tld>" hosting actually costs a
    // real name versus how often it is a platform in disguise.
    expect(
      webResultToRawJobItem({
        title: "Battery R&D Scientist - QuantumScape",
        url: "https://careers.quantumscape.com/jobs/battery-rd-scientist",
        snippet: "Apply now to develop commercial solid-state cells.",
      }),
    ).toMatchObject({
      title: "Battery R&D Scientist",
      company: undefined,
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

  it("uses an owned Himalayas record declaration over an ATS catalog label", () => {
    const item = himalayasJobToRawItem({
      title: "Care Researcher",
      companyName: "Workday",
      description: "<p>At Luminare Health, our people build better care.</p>",
      applicationLink: "https://himalayas.app/jobs/care-researcher",
    });
    expect(item?.company).toBe("Luminare Health");
  });

  it("preserves an ordinary Himalayas catalog label without a declaration", () => {
    const item = himalayasJobToRawItem({
      title: "Research Engineer",
      companyName: "Example Energy",
      description: "<p>Build battery models.</p>",
      applicationLink: "https://himalayas.app/jobs/research-engineer",
    });
    expect(item?.company).toBe("Example Energy");
  });

  it("does not treat an excerpt-only declaration as owned employer evidence", () => {
    const item = himalayasJobToRawItem({
      title: "Research Engineer",
      companyName: "Catalog Energy",
      excerpt: "At Luminare Health, our people build better care.",
      applicationLink: "https://himalayas.app/jobs/excerpt-only",
    });
    expect(item?.company).toBe("Catalog Energy");
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

describe("bare leading year cycles", () => {
  const NOW2 = Date.parse("2026-07-27T00:00:00Z");
  function j(title: string): RawJobItem {
    return {
      id: "jobweb:y", source: "jobweb", title, company: "Lab", location: "",
      isRemote: false, description: "", url: "https://x.test/job/1", tags: [],
    };
  }
  it("drops a posting labelled with a past year", () => {
    expect(isExpiredPosting(j("2025 Battery Research Scientist Graduate Intern"), NOW2)).toBe(true);
  });
  it("keeps the current year", () => {
    expect(isExpiredPosting(j("2026 Battery Research Scientist Graduate Intern"), NOW2)).toBe(false);
  });
  it("ignores a year that is not the cycle label", () => {
    expect(isExpiredPosting(j("Research Scientist, Batteries since 2025"), NOW2)).toBe(false);
  });
});

// RULING 57b (round 21, item 5): THE WIRING, ASSERTED END TO END ON THE JOB
// SURFACE. The guard itself is covered in opportunities/shared.test.ts; this
// proves scoreJobs actually consults it at the required gate. Remove the
// `continue` and this block goes red.
describe("owner-name topic collisions leave the job pool (Ruling 57b)", () => {
  const PE_BODY =
    "Battery is a private equity and venture capital firm with over 40 years of heritage investing in category-leading technology companies.";

  it("drops the private-equity internship a battery researcher kept being shown", () => {
    const collision = job({
      id: "pe",
      title: "2027 Summer Investment Internship",
      company: "Battery Ventures",
      description: PE_BODY,
    });
    const real = job({
      id: "real",
      title: "Battery Materials Process Engineer",
      company: "Battery Resourcers",
      description: "Join our battery recycling team.",
    });
    const scored = scoreJobs([collision, real], { topics: ["battery"] });
    expect(scored.map((s) => s.id)).toEqual(["real"]);
  });

  it("keeps an on-topic employer whose name legitimately contains the topic", () => {
    const operating = job({
      id: "op",
      title: "Process Chemist",
      company: "Ion Exchange Global",
      description: "We manufacture ion exchange resins for industrial water treatment.",
    });
    const scored = scoreJobs([operating], { topics: ["ion exchange"] });
    expect(scored.map((s) => s.id)).toEqual(["op"]);
  });
});

// A23-04 / Ruling 62c — THE ARTICLE-KIND CHECK.
//
// `grad.wisc.edu/2025/11/13/phd-student-internship-opportunities-at-thermo-
// fisher-scientific` is a university NEWS ITEM about somebody else's
// internships, and it reached the pool with `Thermo Fisher Scientific` printed
// as its employer. It is a conjunction because neither half survives alone:
// the URL clause has zero counter-examples and therefore zero controls, and the
// page clause alone drops a real Oak Ridge vacancy that Ruling 34a names.
describe("A23-04 — a dated article is not a job posting", () => {
  const article = (url: string) =>
    job({ url, fetchedPageKind: "article" as const });

  it("drops the measured row", () => {
    expect(
      isNonJobArticle(
        article(
          "https://grad.wisc.edu/2025/11/13/phd-student-internship-opportunities-at-thermo-fisher-scientific",
        ),
      ),
    ).toBe(true);
  });

  // THE ADMITTED CONTROL, and it is the reason the page clause cannot ship
  // alone. A real vacancy, in the pool, named by Ruling 34a, that ALSO declares
  // `og:type=article` because its careers board uses an article template.
  it("KEEPS careerservices.upenn.edu — a real vacancy that declares itself an article", () => {
    expect(
      isNonJobArticle(
        article(
          "https://careerservices.upenn.edu/jobs/oak-ridge-national-laboratory-postdoctoral-research-associate-molten-salt",
        ),
      ),
    ).toBe(false);
  });

  // Both are REAL rows in the offered corpus. A looser URL clause eats them.
  it.each([
    "https://example.test/2026/summer-internships",
    "https://example.test/jobs/2026/molten-salt",
    "https://example.test/2026/11/molten-salt-postdoc",
    "https://example.test/2026/11/13-molten-salt",
  ])("does not match the near-miss URL `%s`", (url) => {
    expect(isNonJobArticle(article(url))).toBe(false);
  });

  it("needs BOTH halves — a date permalink that declares nothing is admitted", () => {
    expect(
      isNonJobArticle(job({ url: "https://grad.wisc.edu/2025/11/13/some-post" })),
    ).toBe(false);
  });

  it("falls to admission when no page was fetched at all", () => {
    // `fetchedPageKind` absent is the normal case: enrichment is capped at 40
    // candidates and some fetches return nothing.
    expect(
      isNonJobArticle(job({ url: "https://grad.wisc.edu/2025/11/13/some-post" })),
    ).toBe(false);
  });

  it("removes the row from the pool, and only that row", () => {
    const blog = job({
      id: "jobweb:blog",
      url: "https://grad.wisc.edu/2025/11/13/phd-student-internship-opportunities",
      fetchedPageKind: "article" as const,
      title: "PhD Student Internship Opportunities at Thermo Fisher Scientific",
      description: "Machine learning internships are open.",
    });
    const upenn = job({
      id: "jobweb:upenn",
      url: "https://careerservices.upenn.edu/jobs/oak-ridge-postdoctoral-research-associate",
      fetchedPageKind: "article" as const,
      title: "Postdoctoral Research Associate, Machine Learning",
      description: "Machine learning postdoctoral research.",
    });
    const scored = scoreJobs([blog, upenn], { topics: ["machine learning"] });
    expect(scored.map((s) => s.id)).toEqual(["jobweb:upenn"]);
  });
});
