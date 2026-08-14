import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { ownedTextHasPostingSubstance, resolveJobPostingScope } from "./job-posting-scope";
import { enrichJobCandidates } from "./enrich";
import { scoredJobToJob } from "@/lib/jobs/mapper";
import { scoreIndustryFit } from "@/lib/jobs/scoring";
import { jobDedupKey } from "@/lib/jobs/dedup";

// A22-03(b) / Ruling 60d (round 22 C): THE MINIMUM-SUBSTANCE FLOOR.
// `resolveJobPostingScope` proves a boundary, not a body — its acceptance
// filter admits a block on ONE self-link or ONE matching heading with no second
// witness, so a block whose entire content IS that witness passes. The strings
// below are the ones B measured `owned` across a live pull; they were harmless
// only while nothing published them. The fail-closed summary gate now does.
describe("ownedTextHasPostingSubstance", () => {
  it("rejects the nav fragments the shipped resolver certifies as owned", () => {
    // Lengths as B measured them: 4, 7, 8, 9, 48 and 74 characters.
    expect(ownedTextHasPostingSubstance("Home")).toBe(false);
    expect(ownedTextHasPostingSubstance("Sitemap")).toBe(false);
    expect(ownedTextHasPostingSubstance("Careers")).toBe(false);
    expect(ownedTextHasPostingSubstance("Apply now")).toBe(false);
    expect(ownedTextHasPostingSubstance("Battery Research Internship - Example Lab Careers")).toBe(false);
    expect(
      ownedTextHasPostingSubstance("Search all open roles at Example Energy and set up a job alert."),
    ).toBe(false);
  });

  it("rejects an 83-character headline, which no bare length floor could (Ruling 59b(b))", () => {
    // The witness that makes this a BODY test and not a length guess: the
    // resolver certified a blog post's headline as owned. A headline is a
    // single fragment however long it runs, so a character count set above 83
    // would only be taste — a posting body says more than one thing.
    const headline = "Graduate Internship Opportunities In Battery And Molten Salt Research Announced";
    expect(headline.length).toBeGreaterThan(74);
    expect(ownedTextHasPostingSubstance(headline)).toBe(false);
  });

  it("accepts a real posting body — the admitted control", () => {
    expect(
      ownedTextHasPostingSubstance(
        "You will develop solid-state battery cells for a growing research team. "
        + "Applicants should hold a PhD in electrochemistry or a related field.",
      ),
    ).toBe(true);
  });

  it("does not accept a body padded out with short fragments", () => {
    // Two sentences are not enough on their own; each must clear the length
    // this codebase already publishes at (summarize.ts's MIN_SENTENCE_LENGTH).
    expect(ownedTextHasPostingSubstance("Apply now. Save this job. Share it. See more roles.")).toBe(false);
  });
});

describe("resolveJobPostingScope", () => {
  it("selects a smallest DOM owner by exact canonical link", () => {
    const scope = resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"https://jobs.example.com/role","jobLocation":{"address":{"addressLocality":"Chicago"}}}</script><article><a href="/role">Selected role</a><p>Owned text.</p></article><article><a href="/other">Foreign role</a><p>Foreign text.</p></article>`,
      { url: "https://jobs.example.com/role", title: "Selected role" },
    );
    expect(scope).toMatchObject({ status: "owned", text: "Selected role Owned text.", structured: { place: { city: "Chicago" } } });
  });

  it("keeps a matching structured record when the page includes surrounding content", () => {
    const scope = resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"https://jobs.example.com/role","jobLocation":{"address":{"addressLocality":"Chicago"}}}</script><article><a href="/role">Selected posting</a><p>Owned text.</p></article><main>${"Detailed opportunity information. ".repeat(800)}</main>`,
      { url: "https://jobs.example.com/role", title: "Solid-State Battery Research Scientist 2" },
    );
    expect(scope).toMatchObject({ status: "owned", structured: { place: { city: "Chicago" } } });
  });

  it("uses the owned scope in enrichment", async () => {
    const html = `<script type="application/ld+json">{"@type":"JobPosting","url":"https://jobs.example.com/role","jobLocation":{"address":{"addressLocality":"Chicago"}}}</script><article><a href="/role">Selected posting</a><p>Owned text.</p></article><main>${"Detailed opportunity information. ".repeat(800)}</main>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html, { status: 200 })));
    const [item] = await enrichJobCandidates([{
      id: "jobweb:scope", source: "jobweb", title: "Solid-State Battery Research Scientist 2",
      company: "Example Lab", location: "", isRemote: false, description: "raw", url: "https://jobs.example.com/role", tags: [],
    }]);
    expect(item).toMatchObject({ place: { city: "Chicago" }, fetchedPostingScope: "owned" });
    vi.unstubAllGlobals();
  });

  it("normalizes only host case, a trailing slash, and a fragment", () => {
    const scope = resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"https://JOBS.example.com/role/?id=7#apply","description":"Owned description."}</script>`,
      { url: "https://jobs.example.com/role?id=7", title: "Selected role" },
    );
    expect(scope).toMatchObject({ status: "owned", text: "Owned description." });
    expect(resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"https://jobs.example.com/role?id=8","description":"Foreign query."}</script>`,
      { url: "https://jobs.example.com/role?id=7", title: "Selected role" },
    )).toEqual({ status: "unproven" });
  });

  it("uses only the exact-URL JSON-LD fallback when no DOM owner exists", () => {
    const scope = resolveJobPostingScope(
      `<script type="application/ld+json">[{"@type":"JobPosting","url":"https://jobs.example.com/selected","description":"Selected fallback duties.","employmentType":"INTERN"},{"@type":"JobPosting","url":"https://jobs.example.com/foreign","description":"Foreign-marker hybrid visa sponsorship.","employmentType":"FULL_TIME"}]</script><main>Listing shell.</main>`,
      { url: "https://jobs.example.com/selected", title: "Selected internship" },
    );

    expect(scope).toMatchObject({
      status: "owned",
      text: "Selected fallback duties.",
      structured: { employmentType: "intern" },
    });
    expect(scope.status === "owned" && scope.text).not.toContain("Foreign-marker");
  });

  it("retains hiringOrganization only from the exact selected JobPosting", () => {
    const scope = resolveJobPostingScope(
      `<script type="application/ld+json">[{"@type":"JobPosting","url":"https://jobs.example.com/selected","description":"At Luminare Health, our people build care.","hiringOrganization":{"name":"Luminare Health"}},{"@type":"JobPosting","url":"https://jobs.example.com/foreign","description":"Foreign.","hiringOrganization":{"name":"Foreign Corp"}}]</script>`,
      { url: "https://jobs.example.com/selected", title: "Selected role" },
    );
    expect(scope).toMatchObject({ status: "owned", structured: { hiringOrganization: "Luminare Health" } });
  });

  it("fails closed for malformed URLs and distinct matching records", () => {
    expect(resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"not a URL","description":"Owned."}</script>`,
      { url: "https://jobs.example.com/role", title: "Selected role" },
    )).toEqual({ status: "unproven" });
    expect(resolveJobPostingScope(
      `<script type="application/ld+json">[{"@type":"JobPosting","url":"https://jobs.example.com/role","description":"First."},{"@type":"JobPosting","url":"https://jobs.example.com/role","description":"Second."}]</script>`,
      { url: "https://jobs.example.com/role", title: "Selected role" },
    )).toEqual({ status: "unproven" });
  });

  it("keeps every job-text consumer inside the selected DOM owner", async () => {
    const selectedUrl = "https://jobs.example.com/selected";
    const selectedTitle = "Battery Internship at Example Lab";
    const html = [
      `<script type="application/ld+json">[{"@type":"JobPosting","url":"${selectedUrl}","description":"Selected research duties."},{"@type":"JobPosting","url":"https://jobs.example.com/foreign","description":"Foreign-marker hybrid visa sponsorship.","validThrough":"2030-01-01","baseSalary":{"value":{"minValue":999999,"maxValue":1000000,"unitText":"YEAR"}},"jobLocation":{"address":{"addressLocality":"Elsewhere"}}}]</script>`,
      // A22-03(b) / Ruling 60d (round 22 C): both blocks extended from one
      // sentence to a body. The minimum-substance floor requires an owned
      // block to carry two publishable sentences, and these synthetic blocks
      // were shorter than the nav fragments the floor exists to reject. What
      // this case tests — that every job-text consumer stays inside the
      // SELECTED owner and never reads the foreign sibling — is unchanged, and
      // the foreign block is padded too so it stays a live temptation rather
      // than being disqualified by length.
      `<article><h2>${selectedTitle}</h2><p>Selected research duties. Interns join the electrochemistry group for two terms.</p></article>`,
      `<article><h2>Foreign battery role</h2><p>Foreign-marker hybrid visa sponsorship. This other listing sponsors relocation for senior staff.</p></article>`,
    ].join("");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html, { status: 200 })));

    const [item] = await enrichJobCandidates([{
      id: "jobweb:owned-boundary", source: "jobweb", title: selectedTitle,
      company: "Example Lab", location: "", isRemote: false, description: "Raw source description.", url: selectedUrl, tags: [],
    }]);
    const reportJob = scoredJobToJob({
      ...item, score: 0.8, matchedKeywords: [], matchReason: "Relevant.",
    });

    expect(item).toMatchObject({ fetchedPostingScope: "owned", roleKind: "internship" });
    expect(item.pageText).toContain("Selected research duties.");
    expect(item.pageText).not.toContain("Foreign-marker");
    expect(item.workMode).toBeUndefined();
    expect(item.visa).toMatchObject({ state: "not-stated" });
    expect(item.visa?.evidence).toBeUndefined();
    expect(item.place).toBeUndefined();
    expect(item.applicationDeadline).toBeUndefined();
    expect(item.salaryMin).toBeUndefined();
    expect(reportJob.summary).toContain("Selected research duties.");
    expect(reportJob.summary).not.toContain("Foreign-marker");
    vi.unstubAllGlobals();
  });

  it("makes an unproven successful fetch silent while preserving source scoring text byte-for-byte", async () => {
    const description = "University research duties from the selected source.";
    const foreignMarker = "Foreign-marker hybrid visa sponsorship.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      `<main><article><h2>Different role</h2><p>${foreignMarker}</p></article></main>`,
      { status: 200 },
    )));

    const [item] = await enrichJobCandidates([{
      id: "jobweb:unproven-boundary", source: "jobweb", title: "Selected internship",
      company: "Example Lab", location: "", isRemote: false, description, url: "https://jobs.example.com/selected", tags: [],
    }]);
    const reportJob = scoredJobToJob({
      ...item, score: 0.8, matchedKeywords: [], matchReason: "Relevant.",
    });

    expect(item).toMatchObject({ fetchedPostingScope: "unproven", description });
    expect(item.pageText).toBeUndefined();
    expect(item.description).toBe(description);
    expect(scoreIndustryFit(item, "academia")).toBe(1);
    expect(reportJob.summary).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("keeps a source-owned employer when a fetched page is unproven", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      "<main><h2>Different role</h2><p>At Foreign Corp, our people work here.</p></main>",
      { status: 200 },
    )));
    const [item] = await enrichJobCandidates([{
      id: "himalayas:owned-employer", source: "himalayas", title: "Selected role",
      company: "Luminare Health", location: "Remote", isRemote: true,
      description: "At Luminare Health, our people build care.",
      url: "https://jobs.example.com/selected", tags: [],
    }]);
    expect(item).toMatchObject({ company: "Luminare Health", fetchedPostingScope: "unproven" });
    expect(item.pageText).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("silences employer identity when selected structured and owned text conflict", async () => {
    const selectedUrl = "https://jobs.example.com/selected";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"${selectedUrl}","hiringOrganization":{"name":"Structured Health"}}</script><article><a href="/selected">Selected role</a><p>At Declared Health, our employees build care.</p></article>`,
      { status: 200 },
    )));
    const [item] = await enrichJobCandidates([{
      id: "jobweb:employer-conflict", source: "jobweb", title: "Selected role",
      company: "Catalog Health", location: "", isRemote: false,
      description: "At Declared Health, our employees build care.", url: selectedUrl, tags: [],
    }]);
    expect(item).toMatchObject({ fetchedPostingScope: "owned" });
    expect(item.company).toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("uses the resolved employer consistently for report mapping, dedup, and fit", () => {
    const item = {
      id: "himalayas:luminare", source: "himalayas" as const, title: "Care Researcher",
      company: "Luminare Health", location: "Remote", isRemote: true,
      description: "At Luminare Health, our people build care.",
      url: "https://jobs.example.com/luminare", tags: [],
    };
    const mapped = scoredJobToJob({ ...item, score: 0.8, matchedKeywords: [], matchReason: "Relevant." });
    expect(mapped.companyOrLab).toBe("Luminare Health");
    expect(jobDedupKey(item)).toContain("luminare");
    expect(scoreIndustryFit(item, "industry")).toBe(1);
  });

  // B8-07 (round 8): Ruling 29 asked whether the specific markup shape B
  // derived from selectedDomScopes' own recognised-tag scan — multiple
  // listings with no per-listing wrapper among article/li/section/div/main
  // — could really defeat the selector. Per Ruling 31: write the fixture,
  // and if it reproduces, this is an ordinary fix item, not a policy
  // question anymore. Confirmed BEFORE any fix was written: both shapes
  // below returned a block spanning more than one listing. One is fixed
  // here; one is not (see the last case). A passing fixture settles whether
  // the MECHANISM can misbehave, not whether any real page has this shape —
  // the frequency question stays open and de-prioritised, recorded here,
  // not silently dropped.
  describe("same-page multi-listing contamination (B8-07)", () => {
    it("no longer contaminates when listings are laid out as sibling <tr> rows with no per-listing wrapper", () => {
      // Confirmed repro before this item's fix: the only candidate block
      // selectedDomScopes found was the whole <table>'s outer <div>,
      // spanning both rows' text, because `tr` was not in the recognised
      // tag set at all. Fixed by adding `tr` to that set — the acceptance
      // logic itself (exact-link/heading witnesses) is unchanged; a `tr`
      // candidate must still pass every existing check, the same as any
      // other tag. This is the same "widen WHERE a candidate may be found,
      // not WHAT counts as one" principle page-text.ts's own
      // extractPageHeadings already uses for <li>/<td> rows.
      const selectedUrl = "https://jobs.example.com/selected";
      const html =
        `<div><table>` +
        `<tr><td><a href="${selectedUrl}">Selected Role</a></td><td>Selected duties.</td></tr>` +
        `<tr><td><a href="https://jobs.example.com/foreign">Foreign Role</a></td><td>Foreign duties.</td></tr>` +
        `</table></div>`;
      const scope = resolveJobPostingScope(html, { url: selectedUrl, title: "Selected Role" });
      expect(scope).toMatchObject({ status: "owned", text: "Selected Role Selected duties." });
      expect(scope.status === "owned" && scope.text).not.toContain("Foreign");
    });

    it("a legitimate secondary link in the same row (an apply button) does not defeat the fix", () => {
      // Guards against over-correcting: the existing acceptance logic's own
      // comment already establishes that a bounded posting block may
      // legitimately carry more than one link (an apply button, a schedule
      // link) alongside its canonical URL. A second href in the SAME row
      // must not be mistaken for a second listing.
      const selectedUrl = "https://jobs.example.com/selected";
      const html =
        `<div><table>` +
        `<tr><td><a href="${selectedUrl}">Selected Role</a> <a href="https://jobs.example.com/selected/apply">Apply</a></td><td>Selected duties.</td></tr>` +
        `<tr><td><a href="https://jobs.example.com/foreign">Foreign Role</a></td><td>Foreign duties.</td></tr>` +
        `</table></div>`;
      const scope = resolveJobPostingScope(html, { url: selectedUrl, title: "Selected Role" });
      expect(scope).toMatchObject({ status: "owned" });
      expect(scope.status === "owned" && scope.text).not.toContain("Foreign");
    });

    it("an unrelated <tr> elsewhere on the page does not create a false match", () => {
      // Widening the tag set must not make an incidental table row (page
      // navigation, unrelated content) a candidate just because it is now a
      // recognised tag — it still has to pass the same exact-link/heading
      // acceptance check as before.
      const selectedUrl = "https://jobs.example.com/selected";
      const html =
        `<tr><td><a href="https://example.com/nav-item">Site Nav Item</a></td></tr>` +
        `<main><a href="${selectedUrl}">Selected Role</a><p>Selected duties.</p></main>`;
      const scope = resolveJobPostingScope(html, { url: selectedUrl, title: "Selected Role" });
      expect(scope).toMatchObject({ status: "owned", text: "Selected Role Selected duties." });
    });

    it("KNOWN, CONFIRMED, NOT FIXED THIS ROUND: flat sibling listings with no wrapper tag at all still contaminate", () => {
      // The second shape B derived, and the harder one. Safely fixing this
      // would require a materially new mechanism — detecting repeated
      // sibling structure with no containing tag at all — which Ruling 29
      // explicitly cautions against building without a live counterexample
      // forcing it, and B did not propose a design for this specific shape
      // (B's job this round was diagnosis, not a fix direction, for either
      // shape). This test documents CURRENT, STILL-WRONG behavior so it is
      // recorded, not dropped, and so any future fix is forced to
      // consciously update this assertion rather than silently regress
      // further. A green run of this test is not a sign of health — it is
      // the open finding, on record. Flagging for the next A/B rather than
      // leaving this only as a log sentence that could get lost.
      const selectedUrl = "https://jobs.example.com/selected";
      const html =
        `<main>` +
        `<a href="${selectedUrl}">Selected Role</a><p>Selected duties.</p>` +
        `<a href="https://jobs.example.com/foreign">Foreign Role</a><p>Foreign duties.</p>` +
        `</main>`;
      const scope = resolveJobPostingScope(html, { url: selectedUrl, title: "Selected Role" });
      expect(scope.status).toBe("owned");
      expect(scope.status === "owned" && scope.text).toContain("Foreign");
    });
  });
});
