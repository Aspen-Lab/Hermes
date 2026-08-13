import { describe, expect, it } from "vitest";
import { highlightSegments, summarizeJob } from "./summarize";

const REAL_POSTING_FIXTURES = [
  {
    name: "Workada — Data Labeling Specialists",
    terms: ["labeled data", "quality"],
    description:
      "Workada creates high-quality labeled data for advanced technology systems. Our team reviews, organizes, categorizes, evaluates, and quality-checks digital content so those systems can better understand information and perform real-world tasks. We believe careful data work matters. We're hiring detail-oriented individuals who are comfortable working on a computer and interested in careful, focused digital work.",
  },
  {
    name: "Outsite — Business Development Representative",
    terms: ["outbound sales", "remote"],
    description:
      "Outsite is a global coliving company for remote workers, offering extended-stay flexibility and a built-in community. Role Overview: We're hiring a Business Development Representative to build and run outbound sales for Outsite for Teams. You'll identify and prospect the right companies, run discovery calls, and close new business. This is a highly autonomous, build-it-yourself role where you'll help shape the outbound playbook.",
  },
  {
    name: "TELUS Digital — Online Data Analyst",
    terms: ["research", "digital maps"],
    description:
      "This freelance opportunity allows you to work at your own pace and from the comfort of your own home. In this role, you will enhance the content and quality of digital maps used by millions of people worldwide. You will complete research and evaluation tasks such as verifying and comparing data and determining the relevance and accuracy of information. Equal Opportunity: All qualified applicants will receive consideration without regard to race, color, religion, sex, national origin, disability, or protected veteran status.",
  },
] as const;

describe("summarizeJob", () => {
  it.each(REAL_POSTING_FIXTURES)(
    "extracts a compact, useful summary from $name",
    ({ description, terms }) => {
      const summary = summarizeJob(description, [...terms]);
      expect(summary).not.toBe("");
      expect(summary.length).toBeLessThanOrEqual(240);
      expect(summary).not.toMatch(/equal opportunity|without regard to/i);
    },
  );

  it("returns selected sentences in their original order", () => {
    const description =
      "This role supports a growing engineering organization across several product lines. You will build battery models for production research teams. You will analyze solid-state battery experiments and share the results.";
    const summary = summarizeJob(description, ["battery", "solid-state battery"]);

    expect(summary.indexOf("build battery models")).toBeLessThan(
      summary.indexOf("analyze solid-state battery"),
    );
  });

  it("returns an empty string when no sentence survives", () => {
    expect(summarizeJob("", ["battery"])).toBe("");
    expect(summarizeJob("Too short.", ["battery"])).toBe("");
    expect(
      summarizeJob(
        "Equal opportunity employer. Apply now by submitting your application.",
        ["battery"],
      ),
    ).toBe("");
  });

  // B4-04 (round 4): a run of concatenated ATS form-field labels ("Apply to
  // job Employment type: Full time Experience required: ...") had no guard
  // at all and could win a high enough score to be selected — R4's own
  // repro, paraphrased here rather than reproduced verbatim.
  it("rejects a run of scraped ATS labels while keeping a genuine sentence", () => {
    const description =
      "Apply to job Employment type: Full time Experience required: Entry level Location: Remote. " +
      "You will research solid-state battery materials and support daily electrochemistry experiments.";
    const summary = summarizeJob(description, ["battery", "electrochemistry"]);
    expect(summary).not.toMatch(/Employment type:/);
    expect(summary).toBe(
      "You will research solid-state battery materials and support daily electrochemistry experiments.",
    );
  });

  it("returns an empty string when the whole description is scraped chrome", () => {
    const description =
      "Apply to job Employment type: Full time Experience required: Entry level Location: Remote.";
    expect(summarizeJob(description, ["battery"])).toBe("");
  });

  it("still credits a single label as a genuine sentence opener, not chrome", () => {
    // Same shape SECTION_RE already rewards — a rule that rejected any
    // single "Label:" opener would break this real, already-working case.
    const { description, terms } = REAL_POSTING_FIXTURES[1];
    const summary = summarizeJob(description, [...terms]);
    expect(summary).toContain("Role Overview");
  });

  // B5-07/R4: real job 2's surviving junk was a different chrome FAMILY than
  // B4-04's ATS-label repro above — e-commerce/shopping-widget furniture,
  // zero colons anywhere, so looksLikeScrapedChrome's colon count never saw
  // it. Paraphrased shape, not the scraped original.
  it("rejects e-commerce/shopping-widget chrome while keeping a genuine sentence", () => {
    const description =
      "3 items in your cart. Add to cart or proceed to payment before checkout closes. In stock: 12 units, SKU 88213-B. " +
      "You will research solid-state battery materials and support daily electrochemistry experiments.";
    const summary = summarizeJob(description, ["battery", "electrochemistry"]);
    expect(summary).not.toMatch(/cart|checkout|sku/i);
    expect(summary).toBe(
      "You will research solid-state battery materials and support daily electrochemistry experiments.",
    );
  });

  // B5-07/R4, the second mechanism: real job 2's junk carried no cart
  // vocabulary at all by the time it reached the title-echo shape — it just
  // trailed off into a near-repeat of the posting's own title. Threading
  // the title through is what catches this; option 1 (NOISE_RE) alone would
  // not.
  it("rejects a sentence that mostly restates the job's own title", () => {
    const description =
      "Great opportunity now open for immediate consideration Marketing Intern Ion Exchange Materials Ltd. " +
      "You will design outreach campaigns and analyze customer engagement data across three regional markets.";
    const summary = summarizeJob(
      description,
      ["marketing", "outreach"],
      "Marketing Intern Ion Exchange Materials Ltd",
    );
    expect(summary).not.toMatch(/immediate consideration/i);
    expect(summary).toBe(
      "You will design outreach campaigns and analyze customer engagement data across three regional markets.",
    );
  });

  it("does not reject a genuine sentence that merely opens by naming the role", () => {
    // Guards against over-correcting: a sentence that NAMES the title near
    // its start and then says something substantive is not the echo shape
    // above — only a sentence with nothing meaningful AFTER the title is.
    const description =
      "As a Marketing Intern Ion Exchange Materials Ltd, you will design outreach campaigns and analyze customer engagement data across three regional markets.";
    const summary = summarizeJob(
      description,
      ["marketing", "outreach"],
      "Marketing Intern Ion Exchange Materials Ltd",
    );
    expect(summary).toContain("design outreach campaigns");
  });

  it("does not apply the title-echo check when no title is supplied (additive, optional)", () => {
    // The third parameter has a default — every pre-existing two-argument
    // call site (all of the above) must behave exactly as before. Same
    // description as the title-echo test above, called with only two
    // arguments: nothing else rejects the first sentence (no colons, no
    // NOISE_RE vocabulary), so without a title it is free to be selected —
    // contrast directly with the title-supplied test, which excludes it.
    const description =
      "Great opportunity now open for immediate consideration Marketing Intern Ion Exchange Materials Ltd. " +
      "You will design outreach campaigns and analyze customer engagement data across three regional markets.";
    const summary = summarizeJob(description, ["marketing", "outreach"]);
    expect(summary).toContain("Great opportunity now open");
  });

  // B8-05 (round 8): scoreSentences previously had only NEGATIVE checks
  // (length, NOISE_RE, looksLikeScrapedChrome, endsWithTitleEcho) — nothing
  // required a survivor to carry POSITIVE evidence of role content, so a
  // sentence scoring only on positionScore/readableLengthScore (structural,
  // not evidence) was still eligible and could outscore genuine content on a
  // short pool. A's fresh real-data pass found this on 4 of 4 non-empty
  // summaries. This block tests the minimal floor (matchedCount > 0 ||
  // sectionScore > 0 || roleScore > 0) B8-05 directed, not the stricter
  // variant it explicitly declined to land without a dedicated risk pass.
  describe("positive-content floor (B8-05)", () => {
    it("rejects pure navigation chrome that carries no positive content signal", () => {
      // B's shape 2 exactly: no colons (looksLikeScrapedChrome needs 2+), no
      // NOISE_RE vocabulary, no keyword, no section heading, no role verb —
      // the shape every existing negative check was proven to miss.
      const description =
        "More about this employer More jobs from this employer University Profile. " +
        "You will investigate solid-state battery degradation mechanisms across three cell chemistries.";
      const summary = summarizeJob(description, ["battery", "degradation"]);
      expect(summary).not.toMatch(/More about this employer/i);
      expect(summary).toBe(
        "You will investigate solid-state battery degradation mechanisms across three cell chemistries.",
      );
    });

    it("keeps a genuine sentence whose only positive signal is a role verb", () => {
      // Isolates the OR: no matched keyword, no section heading, only
      // ROLE_RE — proves the floor doesn't quietly require all three (the
      // easy-to-write version of this check), which would over-reject
      // ordinary descriptive prose that names no profile keyword verbatim.
      const description =
        "Company overview and site navigation footer text goes here for context only padding. " +
        "You will design new synthesis routes for advanced electrode coatings and evaluate their cycling performance.";
      const summary = summarizeJob(description, ["nonexistent-term"]);
      expect(summary).toBe(
        "You will design new synthesis routes for advanced electrode coatings and evaluate their cycling performance.",
      );
    });

    it("does not catch chrome that happens to contain a matched keyword — the minimal floor's named, unfixed limitation", () => {
      // B's shape 3 caveat, verified rather than left as an unchecked claim:
      // "OpenMC" is a real, matched profile keyword, so matchedCount > 0 for
      // this chrome sentence too, and the minimal floor cannot tell it apart
      // from genuine content. This is the hardest case for this item, not
      // the easiest — recorded so a future round doesn't need to
      // rediscover it, and so a green suite here is never read as "R4 fully
      // closed." B8-05 explicitly declined to land the stricter variant
      // that would catch this without a dedicated risk pass; this test
      // documents the boundary, it does not assert desired behavior.
      const description =
        "Job vacancies looking for OpenMC skills Announcements. " +
        "You will develop reactor physics models using OpenMC and validate them against benchmark data.";
      const summary = summarizeJob(description, ["OpenMC", "reactor physics"]);
      expect(summary).toContain("Job vacancies looking for OpenMC");
    });
  });
});

describe("highlightSegments", () => {
  it("round-trips the input exactly and matches longest terms first", () => {
    const text = "Solid-state battery research improves the battery.";
    const segments = highlightSegments(text, ["battery", "solid-state battery"]);

    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(segments[0]).toEqual({ text: "Solid-state battery", matched: true });
    expect(segments.filter((segment) => segment.matched)).toHaveLength(2);
  });

  it("matches case-insensitively with whole-word-ish boundaries", () => {
    const segments = highlightSegments("Battery work differs from batteries.", ["battery"]);

    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      "Battery",
    ]);
  });

  it("escapes regex punctuation in topic terms", () => {
    const text = "Use C++ for analysis (advanced), not C alone.";
    const segments = highlightSegments(text, ["C++", "(advanced)"]);

    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      "C++",
      "(advanced)",
    ]);
  });

  it("merges overlapping matches", () => {
    expect(highlightSegments("battery storage", ["battery", "battery storage"])).toEqual([
      { text: "battery storage", matched: true },
    ]);
  });

  it("returns one unmatched segment for empty terms or no matches", () => {
    expect(highlightSegments("plain text", [])).toEqual([{ text: "plain text", matched: false }]);
    expect(highlightSegments("plain text", ["battery"])).toEqual([
      { text: "plain text", matched: false },
    ]);
  });
});
