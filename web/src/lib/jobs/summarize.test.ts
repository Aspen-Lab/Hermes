import { describe, expect, it } from "vitest";
import { highlightSegments, summarizeJob } from "./summarize";
// B14-02 (round 14): the live reproduction must run through the SAME path the
// mapper uses — `summarizeJob(cleanJobDescription(source), …)` — because the
// whole finding is that the cleaner DID run and still could not see the
// bracket. Summarising the raw source instead would prove nothing.
import { cleanJobDescription } from "@/lib/opportunities/job-cleanup";

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
    // B10-07 fix 1 (round 10): sectionScore now also requires readable
    // content after the label — this sentence's content ("We're hiring a
    // Business Development Representative...") easily clears that bar, so
    // the sentence is still selected.
    const { description, terms } = REAL_POSTING_FIXTURES[1];
    const summary = summarizeJob(description, [...terms]);
    expect(summary).toContain("We're hiring a Business Development Representative");
  });

  // B10-07 fix 2 (round 10, item 8): the label itself is stripped from the
  // DISPLAYED text — a purely cosmetic change layered on top of the
  // selection this test already covers above. Changed from asserting
  // `toContain("Role Overview")` (fix 2 removes it) to asserting its
  // absence, so the display contract stays covered once the label is gone.
  it("strips the leading label from the displayed text of a credited section opener", () => {
    const { description, terms } = REAL_POSTING_FIXTURES[1];
    const summary = summarizeJob(description, [...terms]);
    expect(summary).not.toMatch(/Role Overview:/);
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

  // B10-07 (round 10, items 6+8): a bare section label immediately followed
  // by scraped-page markers (an unbalanced bracket, a bare Markdown heading
  // marker) with nothing readable in between must not clear the floor on
  // sectionScore alone — round 9's own trace found exactly this shape
  // selected with zero keyword or role-verb match. Separately, any credited
  // section opener's label is stripped from the displayed text.
  describe("colon-label chrome (B10-07)", () => {
    it("rejects a section-label opener followed only by scraped-page markers, falling through to a real sentence", () => {
      // Item 6's own exact junk fragment (round 9's trace), paraphrased
      // length-wise but the same shape: a section label, a bare Markdown
      // heading marker, and an unpaired bracket, with no readable content
      // and no keyword/role-verb match anywhere in the fragment.
      const description =
        "Qualifications: ### Get the Saturday tech briefing [and other newsletter signup chrome that never closes its bracket. " +
        "You will research solid-state battery materials and support daily electrochemistry experiments.";
      const summary = summarizeJob(description, ["battery", "electrochemistry"]);
      expect(summary).not.toMatch(/Qualifications:|###|\[/);
      expect(summary).toBe(
        "You will research solid-state battery materials and support daily electrochemistry experiments.",
      );
    });

    it("still credits a section label followed by genuine, readable content, label stripped from display", () => {
      // The hardest must-still-survive case per Ruling 31: the ORIGINAL
      // correct shape sectionScore exists to reward — real content
      // immediately after the label, no scraped-page markers — is still
      // SELECTED. Fix 2 strips the label from display "regardless of why
      // it was selected" (B10-07's own words), so the label itself does not
      // appear in the output even though it drove the selection.
      const description =
        "Qualifications: Design and build reliable battery testing systems for a growing research team.";
      const summary = summarizeJob(description, ["battery"]);
      expect(summary).not.toMatch(/Qualifications:/);
      expect(summary).toBe(
        "Design and build reliable battery testing systems for a growing research team.",
      );
    });

    it("strips a leading label from a sentence legitimately selected on real content, not section credit", () => {
      // Item 8's own live shape: the label plays no role in selection at
      // all (confirmed by construction — no SECTION_RE match, selected
      // purely via roleScore/matchedCount) but is still cosmetic chrome in
      // the displayed text.
      const description =
        "Multi-Level: This is a multi-level posting and you will be placed at the appropriate level dependent on degree field and level of education.";
      const summary = summarizeJob(description, ["battery"]);
      expect(summary).not.toMatch(/Multi-Level:/);
      expect(summary).toBe(
        "This is a multi-level posting and you will be placed at the appropriate level dependent on degree field and level of education.",
      );
    });

    it("does not strip a colon-led phrase that is mid-sentence, not a leading label", () => {
      const description =
        "You will support the team as follows: design, build, and test new battery cell chemistries.";
      const summary = summarizeJob(description, ["battery"]);
      expect(summary).toBe(
        "You will support the team as follows: design, build, and test new battery cell chemistries.",
      );
    });
  });

  // B14-02 (round 14): `careers.gevernova.com` rendered a summary whose TWO
  // SENTENCES EACH OPENED WITH A BARE `]`. In the source each `]` sits
  // immediately after a sentence-ending `.` with NO whitespace between them, so
  // `job-cleanup.ts`'s `ISOLATED_BRACKET_REMNANT_RE` (`/\s+\]\s+/g`) — a shipped
  // rule written for exactly this junk — structurally cannot match it. The
  // cleaner ran; it could not see the bracket. Both brackets land at index 0 of
  // their own sentence after `splitSentences` trims, so it is ONE cause, not
  // two, and the space that appeared around the second one in the render is
  // manufactured by `bestCombination`'s `.join(" ")`.
  describe("a sentence opening with a bare bracket remnant (B14-02)", () => {
    // THE LIVE REPRODUCTION, end to end through the real path the mapper uses:
    // `cleanJobDescription` then `summarizeJob`. The two short bracketed
    // lead-ins fall below MIN_SENTENCE_LENGTH and are never selected, so the
    // reader sees only the two `]`-led sentences — which is exactly what round
    // 14 A measured.
    it("strips the leading bracket from the gevernova shape, end to end", () => {
      const raw =
        "[Overview.] You have a passion for battery technology, energy, and new product development. [The role.] Support engineering teams developing new battery technology for use in the Utilities, Datacenter, and Defense industries.";
      const summary = summarizeJob(cleanJobDescription(raw), ["battery"]);
      expect(summary).not.toContain("]");
      // The sentences themselves must survive INTACT — this is a repair, not a
      // rejection, so nothing but the bracket may be lost.
      expect(summary).toContain(
        "You have a passion for battery technology, energy, and new product development.",
      );
      expect(summary).toContain("Support engineering teams developing new battery technology");
    });

    // THE CONTROL, and it is what makes the diagnosis a diagnosis rather than a
    // fit: the identical text with ONE SPACE added before each bracket already
    // renders clean today, because the shipped upstream rule can finally see
    // whitespace. The defect is one missing space.
    it("leaves the space-preceded control clean, as it already was", () => {
      const raw =
        "[Overview. ] You have a passion for battery technology, energy, and new product development. [The role. ] Support engineering teams developing new battery technology for use in the Utilities, Datacenter, and Defense industries.";
      const summary = summarizeJob(cleanJobDescription(raw), ["battery"]);
      expect(summary).not.toContain("]");
    });

    // THE ORDER IS LOAD-BEARING. `LEADING_LABEL_RE` is `^[A-Z]…`, so a leading
    // `]` blocks it: label-first would strip nothing at all here, then remove
    // the bracket and leave the label standing. Bracket-first makes B10-07
    // fix 2 reachable — that fix's own intent, blocked by the bracket rather
    // than scoped away from it. This assertion is what pins the order.
    it("strips BOTH the bracket and the label, in that order", () => {
      const description =
        "] Role Overview: We're hiring a battery scientist to develop new cell chemistries for grid storage.";
      const summary = summarizeJob(description, ["battery"]);
      expect(summary).not.toContain("]");
      expect(summary).not.toMatch(/Role Overview:/);
      expect(summary).toBe(
        "We're hiring a battery scientist to develop new cell chemistries for grid storage.",
      );
    });

    // B14-02, DISCLOSED CORRECTION TO B's TABLE ROW 2 — MEASURED, NOT WIDENED.
    // B's guide predicted `"] What you'll do: Support…"` would render as
    // `"Support…"`, i.e. that bracket-first makes B10-07 fix 2 reach this
    // string too. IT DOES NOT, and the reason is in `LEADING_LABEL_RE`, not in
    // B14-02: that rule is `[A-Za-z]+` with up to TWO continuation words, so
    // `What you'll do:` fails it twice over — on the apostrophe in `you'll` and
    // on the three-word run. `What you will do:` fails it too.
    //
    // B14-02's own contract is UNAFFECTED and is asserted here: the bracket
    // goes. Only B's secondary claim about the downstream label was wrong.
    // Widening `LEADING_LABEL_RE` to reach apostrophes or a third word is a
    // DIFFERENT item on a DIFFERENT rule with no adversarial measurement behind
    // it, so it was deliberately NOT done inline. Recorded for the manager.
    it("strips the bracket but leaves an apostrophe-bearing label — LEADING_LABEL_RE's limit, not B14-02's", () => {
      const description =
        "] What you'll do: Support engineering teams developing new battery technology for use in the Utilities and Defense industries.";
      const summary = summarizeJob(description, ["battery"]);
      expect(summary).not.toContain("]");
      expect(summary).toBe(
        "What you'll do: Support engineering teams developing new battery technology for use in the Utilities and Defense industries.",
      );
    });

    it("strips a doubled bracket remnant", () => {
      const description =
        "]] Support engineering teams developing new battery technology for use in the Utilities and Defense industries.";
      const summary = summarizeJob(description, ["battery"]);
      expect(summary).not.toContain("]");
      expect(summary).toBe(
        "Support engineering teams developing new battery technology for use in the Utilities and Defense industries.",
      );
    });

    // THE MUST-KEEPS, AND THEY ARE THE POINT. A bracketed clause inside real
    // prose is legitimate English and must survive untouched. These are the two
    // cases that rule out the upstream widening: a rule reaching a `]` after a
    // sentence boundary ORPHANS the `[` of a clause like these, manufacturing
    // the very unmatched-bracket artifact the rule family exists to remove.
    it.each([
      "The bracket [see below] is part of a real sentence and must survive intact for the battery reader.",
      "Applicants must hold a PhD [or equivalent] in materials science or battery electrochemistry.",
    ])("leaves a legitimate bracketed clause untouched: %s", (description) => {
      expect(summarizeJob(description, ["battery"])).toBe(description);
    });

    // The pre-existing behaviours this change must not disturb — B10-07 fix 2's
    // own two cases and an ordinary sentence with no prefix at all.
    it.each([
      [
        "Multi-Level: This is a multi-level posting and you will be placed at the appropriate battery level dependent on degree field.",
        "This is a multi-level posting and you will be placed at the appropriate battery level dependent on degree field.",
      ],
      [
        "Role Overview: We're hiring a battery scientist to develop new cell chemistries for grid storage applications.",
        "We're hiring a battery scientist to develop new cell chemistries for grid storage applications.",
      ],
      [
        "Interface with the advanced research center on battery testing results and report findings to the engineering team.",
        "Interface with the advanced research center on battery testing results and report findings to the engineering team.",
      ],
    ])("is unchanged for %s", (description, expected) => {
      expect(summarizeJob(description, ["battery"])).toBe(expected);
    });

    // RULING 32 FROM THE RENDER SIDE: THIS CAN NEVER EMPTY A SUMMARY. A
    // degenerate `]`-only sentence is unreachable — MIN_SENTENCE_LENGTH (40)
    // rejects it before scoring ever runs — and a real sentence clears that
    // floor on its UNSTRIPPED text, so at least 38 characters always remain.
    it.each(["] ", "]"])("cannot empty the summary: the degenerate %p never reaches scoring", (description) => {
      expect(summarizeJob(description, ["battery"])).toBe("");
    });

    it("keeps a real sentence non-empty after the strip", () => {
      const description =
        "] Support engineering teams developing new battery technology for use in the Utilities and Defense industries.";
      const summary = summarizeJob(description, ["battery"]);
      expect(summary.length).toBeGreaterThan(38);
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
