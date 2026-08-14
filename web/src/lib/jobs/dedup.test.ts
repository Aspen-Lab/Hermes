import { describe, expect, it } from "vitest";
import { dedupJobs, jobDedupKey, jobSlugTokens, slugsIdentifySamePosting } from "./dedup";
import type { RawJobItem } from "./types";

// A22-05 (round 22): the same Savannah River vacancy occupied TWO of twelve job
// slots. A third copy WAS correctly collapsed, so the dedup was partial — which
// is what made the cause worth tracing rather than guessing. B established it
// by executing the shipped key on the three live rows: the key never looks at
// the URL, and it read the first six title words BEFORE sorting them, so the
// vaia copy's inline employer (`… at Savannah River National Laboratory`)
// pushed `research` out of the window and changed the key.
//
// There was no `dedup.test.ts` before this round — `jobs/scoring.test.ts` was
// the only caller of `dedupJobs` anywhere, which is why a shared key function
// went five rounds without direct coverage.

function job(overrides: Partial<RawJobItem> & { id: string }): RawJobItem {
  return {
    source: "jobweb",
    title: "Research Scientist",
    company: "Example Lab",
    location: "",
    isRemote: false,
    description: "",
    url: "https://example.test/jobs/research-scientist-battery-materials-cathode",
    tags: [],
    ...overrides,
  };
}

// The three live rows, with their real slugs. Titles are the offered ones.
const LINKEDIN = job({
  id: "jobweb:linkedin",
  title: "Actinide Chemistry/Ion Exchange Postdoc Research Associate",
  company: undefined,
  url: "https://www.linkedin.com/jobs/view/actinide-chemistry-ion-exchange-postdoc-research-associate-at-savannah-river-national-laboratory-4302881190",
});
const SALUTEMYJOB = job({
  id: "jobweb:salutemyjob",
  title: "Actinide Chemistry/Ion Exchange Postdoc Research ...",
  company: undefined,
  url: "https://salutemyjob.com/jobs/actinide-chemistry-ion-exchange-postdoc-research-associate-columbia-south-carolina/2893886008-2",
});
const VAIA = job({
  id: "jobweb:vaia",
  title: "Actinide Chemistry & Ion Exchange Postdoc at Savannah River National Laboratory",
  company: "Savannah River National Laboratory",
  url: "https://talents.vaia.com/companies/savannah-river-national-laboratory/actinide-chemistry-ion-exchange-postdoc-6062985/",
});

describe("jobDedupKey", () => {
  it("is order-independent within the six-token window, and only there", () => {
    // Honest statement of what the shipped key actually does. Both titles are
    // shorter than the window, so slicing does not bite and the sort delivers.
    expect(jobDedupKey(job({ id: "a", title: "Battery Research Scientist" }))).toBe(
      jobDedupKey(job({ id: "b", title: "Research Scientist Battery" })),
    );
  });

  it("still separates two genuinely different postings at the same employer", () => {
    expect(jobDedupKey(job({ id: "a", title: "Battery Research Technician" }))).not.toBe(
      jobDedupKey(job({ id: "b", title: "Battery Research Scientist" })),
    );
  });

  // A22-05(a) (round 22 C): **B RECOMMENDED SWAPPING SLICE AND SORT. C BUILT
  // IT, MEASURED IT, AND REJECTED IT — IT BREAKS THIS MERGE.**
  //
  // These two live rows are the same vacancy and their keys MATCH today. Under
  // "sort, then slice" they diverge, because `associate` sorts early and
  // displaces `research` out of the six-token window on the longer title only.
  // B measured that (a) does not close A22-05; B did not measure that it
  // re-opens a merge that already works. An un-merge is an EXTRA card, which is
  // the defect class A22-05 is filed under.
  //
  // This assertion is what would go red if a later round reintroduces the swap.
  it("keeps the merge B's recommended sort-then-slice would have broken", () => {
    expect(jobDedupKey(LINKEDIN)).toBe(jobDedupKey(SALUTEMYJOB));
  });
});

describe("jobSlugTokens", () => {
  it("reads the posting-name segment an aggregator put in the path", () => {
    expect(jobSlugTokens(SALUTEMYJOB.url)).toEqual([
      "actinide", "chemistry", "ion", "exchange", "postdoc", "research",
      "associate", "columbia", "south", "carolina",
    ]);
  });

  it("ignores an opaque slug that identifies nothing", () => {
    // Below the four-token floor: too little to identify anything is not
    // evidence that two postings are the same.
    expect(jobSlugTokens("https://example.test/jobs/12345")).toEqual([]);
    expect(jobSlugTokens("https://example.test/apply/req-8891")).toEqual([]);
  });

  it("survives a malformed or absent URL", () => {
    expect(jobSlugTokens("not a url")).toEqual([]);
    expect(jobSlugTokens(undefined)).toEqual([]);
  });
});

describe("slugsIdentifySamePosting", () => {
  it("collides a truncated transcription with the full one", () => {
    // Aggregators truncate an employer's title; they do not rewrite it. So a
    // truncation is a PREFIX, and that is the whole rule.
    expect(slugsIdentifySamePosting(jobSlugTokens(VAIA.url), jobSlugTokens(SALUTEMYJOB.url))).toBe(true);
    expect(slugsIdentifySamePosting(jobSlugTokens(VAIA.url), jobSlugTokens(LINKEDIN.url))).toBe(true);
  });

  it("does NOT collide two postings that share a prefix and then diverge", () => {
    // The must-keep that makes the rule safe. B named this as the one way this
    // item can create wrong data rather than remove it: a widened key silently
    // merging two genuinely different postings. Four shared tokens, and neither
    // sequence is a prefix of the other.
    expect(
      slugsIdentifySamePosting(
        jobSlugTokens("https://example.test/jobs/research-scientist-battery-materials-cathode"),
        jobSlugTokens("https://example.test/jobs/research-scientist-battery-materials-anode"),
      ),
    ).toBe(false);
  });

  it("never collides on an absent slug", () => {
    expect(slugsIdentifySamePosting([], ["actinide", "chemistry", "exchange", "postdoc"])).toBe(false);
  });
});

describe("dedupJobs", () => {
  it("collapses all three copies of one vacancy into one card (A22-05)", () => {
    // Today two of these three survive: the title key alone collapses
    // salutemyjob into linkedin and stops there, because the vaia copy's
    // inline employer changes its title key and nothing looks at the URL.
    // Note this needs the UNION, not a first-match lookup — vaia's slug is a
    // prefix of both the others, but those two diverge from each other.
    const result = dedupJobs([LINKEDIN, SALUTEMYJOB, VAIA]);
    expect(result).toHaveLength(1);
  });

  it("keeps the copy that names the employer when priority ties (the tie-break)", () => {
    // NOT OPTIONAL. All three are `jobweb`, so before this rule the survivor
    // was decided by arrival order — which gave the linkedin row, rendering no
    // employer at all, while the vaia row it failed to merge with renders the
    // employer correctly. Without this the fix trades two cards for a worse one.
    expect(dedupJobs([LINKEDIN, SALUTEMYJOB, VAIA])[0].company).toBe(
      "Savannah River National Laboratory",
    );
    // Order-independent: the same survivor whichever copy arrives first.
    expect(dedupJobs([VAIA, LINKEDIN, SALUTEMYJOB])[0].company).toBe(
      "Savannah River National Laboratory",
    );
  });

  it("still lets a richer source outrank a web scrape", () => {
    // The pre-existing contract, unchanged: priority beats the tie-break.
    const structured = job({
      id: "usajobs:1",
      source: "usajobs",
      company: undefined,
      title: "Actinide Chemistry/Ion Exchange Postdoc Research Associate",
      url: "https://usajobs.gov/job/actinide-chemistry-ion-exchange-postdoc-research-associate",
    });
    expect(dedupJobs([VAIA, structured])[0].source).toBe("usajobs");
  });

  it("does not merge two different postings that share a slug prefix", () => {
    const cathode = job({
      id: "jobweb:cathode",
      title: "Research Scientist, Battery Materials — Cathode",
      url: "https://example.test/jobs/research-scientist-battery-materials-cathode",
    });
    const anode = job({
      id: "jobweb:anode",
      title: "Research Scientist, Battery Materials — Anode",
      url: "https://example.test/jobs/research-scientist-battery-materials-anode",
    });
    expect(dedupJobs([cathode, anode])).toHaveLength(2);
  });

  it("unites a chain where each link shares a DIFFERENT signal", () => {
    // The shape the union exists for, built explicitly because the live rows
    // do not exercise it: A shares a slug prefix with C, B shares a title key
    // with C, and A and B share NEITHER. All three are one vacancy.
    const a = job({
      id: "jobweb:a",
      title: "Molten Salt Corrosion Engineer Reactor Programme Idaho",
      company: "Example Energy",
      url: "https://board-a.test/jobs/molten-salt-corrosion-engineer",
    });
    const b = job({
      id: "jobweb:b",
      title: "Corrosion Engineer Molten Salt",
      company: undefined,
      url: "https://board-b.test/apply/req-88910",
    });
    const c = job({
      id: "jobweb:c",
      title: "Corrosion Engineer Molten Salt",
      company: undefined,
      url: "https://board-c.test/jobs/molten-salt-corrosion-engineer-idaho-falls",
    });
    // The premises, asserted so the case cannot quietly stop testing the union.
    expect(jobDedupKey(b)).toBe(jobDedupKey(c));
    expect(jobDedupKey(a)).not.toBe(jobDedupKey(b));
    expect(jobSlugTokens(b.url)).toEqual([]);
    expect(slugsIdentifySamePosting(jobSlugTokens(a.url), jobSlugTokens(c.url))).toBe(true);
    expect(dedupJobs([a, b, c])).toHaveLength(1);
    // And the tie-break still picks the copy that names the employer.
    expect(dedupJobs([a, b, c])[0].company).toBe("Example Energy");
  });

  it("leaves unrelated postings alone", () => {
    const other = job({
      id: "jobweb:other",
      title: "Molten Salt Corrosion Engineer",
      company: "Example Energy",
      url: "https://example.test/jobs/molten-salt-corrosion-engineer-idaho-falls",
    });
    expect(dedupJobs([VAIA, other])).toHaveLength(2);
  });

  it("keeps an item whose title and company are both empty", () => {
    // The pre-existing escape hatch: with no usable key the item is kept under
    // its own id rather than colliding with every other empty-keyed row.
    const blank = job({ id: "jobweb:blank", title: "", company: "", url: "https://example.test/x" });
    const other = job({ id: "jobweb:blank2", title: "", company: "", url: "https://example.test/y" });
    expect(dedupJobs([blank, other])).toHaveLength(2);
  });
});
