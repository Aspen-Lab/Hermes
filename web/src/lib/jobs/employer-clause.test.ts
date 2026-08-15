import { describe, expect, it } from "vitest";
import { stripRedundantEmployerClause } from "./employer-clause";
import { scoredJobToJob } from "./mapper";
import type { ScoredJobItem } from "./types";

/**
 * A26-01 (round 26 A; mechanism corrected by round 26 B; landed round 26 C,
 * item 1). The card states the employer TWICE on two adjacent lines — title
 * `… at Tesla` directly above subtitle `Tesla`.
 *
 * **VACUITY DISCIPLINE.** Every clause of the shipped rule below carries a case
 * that is UNIQUELY RED when that clause alone is removed; the mutation and its
 * red count are recorded in the round log. The cases that stay green under a
 * full revert are ADMITTED CONTROLS and are labelled as such in their own
 * `describe` — they are here to prove the strip does not over-reach, which is
 * A's own second falsifier, and they are not counted as proof the fix landed.
 */
describe("stripRedundantEmployerClause (A26-01)", () => {
  /**
   * B's live sweep: 112 offered rows, union 96, 43 rendered by the shipped
   * mapper, and exactly THREE state the employer twice. All three are locked
   * here by their real strings, because A26-01 is a CLASS and not an
   * `ev.careers` quirk — the two hosts that were never the reported row are the
   * stronger witnesses.
   */
  describe("the three live rows that state the employer twice", () => {
    it("drops the clause on ev.careers — A26-01's own reported row", () => {
      expect(
        stripRedundantEmployerClause(
          "Internship, Battery Engineering (Summer 2026) at Tesla",
          "Tesla",
        ),
      ).toBe("Internship, Battery Engineering (Summer 2026)");
    });

    it("drops the clause on grad.wisc.edu — a second host", () => {
      expect(
        stripRedundantEmployerClause(
          "PhD Student Internship Opportunities at Thermo Fisher Scientific",
          "Thermo Fisher Scientific",
        ),
      ).toBe("PhD Student Internship Opportunities");
    });

    it("drops the clause on careers.jnj.com — a third host", () => {
      expect(stripRedundantEmployerClause("Internships at J&J", "J&J")).toBe(
        "Internships",
      );
    });
  });

  /**
   * One case per CLAUSE of the rule. Each is red when its own clause is
   * removed and green otherwise — that is what makes them locks rather than
   * decoration.
   */
  describe("each clause of the rule carries its own lock", () => {
    it("escapes regex metacharacters in the employer name", () => {
      // UNIQUELY RED without `escapeRegExp`: unescaped, `(US)` is a capture
      // GROUP, so the pattern would look for the literal `Acme US Inc.` and
      // this title would keep its clause.
      expect(
        stripRedundantEmployerClause(
          "Process Engineer at Acme (US) Inc.",
          "Acme (US) Inc.",
        ),
      ).toBe("Process Engineer");
      // The `.` case, from the same class: unescaped it is "any character".
      expect(
        stripRedundantEmployerClause("Analyst at C.H. Robinson", "C.H. Robinson"),
      ).toBe("Analyst");
    });

    it("never empties the title, even when the clause is the whole title", () => {
      // UNIQUELY RED without `stripped ? stripped : roleTitle` — that mutation
      // returns "". A blank card line is worse than a repeated word.
      //
      // THE LEADING SPACE IS LOAD-BEARING AND C SAYS WHY. The pattern requires
      // `\s+` before `at`, so `"at Tesla"` (no leading space) never matches at
      // all and would leave this guard UNEXERCISED — C's first version of this
      // case did exactly that and the mutation came back green, which is how it
      // was caught. `" at Tesla"` is the ONLY shape that reaches the guard, and
      // it is unreachable in the real pipeline because `cleanJobTitle` trims
      // before the mapper. So this clause is DEFENSIVE: it is genuinely locked
      // here, and its only witness is an input the pipeline cannot produce.
      expect(stripRedundantEmployerClause(" at Tesla", "Tesla")).toBe(" at Tesla");
      // and the trimmed form, which the pipeline CAN produce, is untouched for
      // the different reason that it never matches
      expect(stripRedundantEmployerClause("at Tesla", "Tesla")).toBe("at Tesla");
    });

    it("trims the employer field before matching", () => {
      // UNIQUELY RED without `company?.trim()`: the pattern would carry the
      // trailing space and could not match a title that ends at `Tesla`.
      expect(stripRedundantEmployerClause("Battery Engineer at Tesla", "Tesla ")).toBe(
        "Battery Engineer",
      );
    });

    it("trims the surviving title", () => {
      // UNIQUELY RED without `.trim()` on the result — it would return
      // "  Battery Engineer" with its leading spaces intact.
      expect(
        stripRedundantEmployerClause("  Battery Engineer at Tesla", "Tesla"),
      ).toBe("Battery Engineer");
    });

    it("returns the title untouched when there is no employer field", () => {
      // UNIQUELY RED without the `if (!employer) return roleTitle` guard: with
      // `company === undefined` the escape helper is handed `undefined` and
      // throws. This is also the COMMON case — 40 of B's 43 rendered rows have
      // no company — and it is the boundary `job-cleanup.test.ts:49` already
      // encodes: when the clause is the reader's ONLY source of the employer it
      // must survive.
      expect(
        stripRedundantEmployerClause(
          "Research in Reno at American Battery",
          undefined,
        ),
      ).toBe("Research in Reno at American Battery");
      expect(stripRedundantEmployerClause("Research in Reno", "")).toBe(
        "Research in Reno",
      );
    });
  });

  /**
   * **ADMITTED CONTROLS — GREEN BOTH WAYS, AND SAID SO.** A full revert of the
   * fix leaves every case in this block passing, because the reverted function
   * returns its input unchanged and "unchanged" is exactly what these assert.
   * They are not evidence the fix landed. They are evidence it does not
   * over-reach, which is A's own second falsifier and the more expensive
   * failure of the two. Each one IS uniquely red against a specific
   * OVER-REACHING mutation, named in its comment.
   */
  describe("admitted controls — the strip must not over-reach", () => {
    it("does not fire when the clause employer differs from the field", () => {
      // The live `q-chem.com` row (B26-OBS-02: its company renders as the
      // one-letter fragment `Q`). Red against a mutation that matched any
      // trailing ` at <Word>`.
      expect(stripRedundantEmployerClause("Summer at Q-Chem", "Q")).toBe(
        "Summer at Q-Chem",
      );
    });

    it("does not fire when another candidate won the employer slot", () => {
      expect(
        stripRedundantEmployerClause("Battery Engineer at Careers", "Acme Labs"),
      ).toBe("Battery Engineer at Careers");
    });

    it("does not fire on a mid-title clause", () => {
      // Red against dropping the `\s*$` anchor, which would render
      // "Battery Engineer (Remote)". End-anchored on purpose: a mid-title
      // `at X` is far more often a qualifier or a place.
      expect(
        stripRedundantEmployerClause("Battery Engineer at Tesla (Remote)", "Tesla"),
      ).toBe("Battery Engineer at Tesla (Remote)");
    });

    it("does not fire on a different casing", () => {
      // Red against adding the `i` flag.
      expect(stripRedundantEmployerClause("Battery Engineer at TESLA", "Tesla")).toBe(
        "Battery Engineer at TESLA",
      );
    });

    it("does not read a word merely ENDING in 'at' as the preposition", () => {
      // MEASURED, NOT ASSUMED: `\s+` and `\b` are REDUNDANT WITH EACH OTHER
      // here. Dropping `\s+` alone leaves this green; dropping `\b` alone
      // leaves this green; only dropping BOTH turns it red. So this case locks
      // the PAIR, and neither half is claimed as a lock of its own.
      expect(
        stripRedundantEmployerClause("Battery Engineer format Tesla", "Tesla"),
      ).toBe("Battery Engineer format Tesla");
    });

    it("does not fire on a substring that is not a clause", () => {
      expect(
        stripRedundantEmployerClause("Battery Engineer, Format Cells", "Format Cells"),
      ).toBe("Battery Engineer, Format Cells");
    });

    it("cannot corrupt a title when the employer NAME itself contains ' at '", () => {
      expect(
        stripRedundantEmployerClause(
          "Co-op",
          "McKelvey School of Engineering at Washington University in St. Louis",
        ),
      ).toBe("Co-op");
    });

    it("cannot match a provider-truncated title", () => {
      // The enrichment path. The clause is end-anchored and `...` is not the
      // employer, so a title still awaiting `extendTruncatedTitle` is safe.
      expect(
        stripRedundantEmployerClause(
          "Actinide Chemistry/Ion Exchange Postdoc Research ...",
          "Savannah River National Laboratory",
        ),
      ).toBe("Actinide Chemistry/Ion Exchange Postdoc Research ...");
    });
  });
});

/**
 * The rule is also proven AT THE SHIPPED CALL SITE, not only in the module —
 * and the ordering constraint is proven with it, because that constraint is the
 * one thing a correct-looking call site can silently break.
 */
describe("scoredJobToJob strips the redundant clause at the field (A26-01)", () => {
  const base: ScoredJobItem = {
    id: "jobweb:a26-01",
    source: "jobweb",
    title: "Internship, Battery Engineering (Summer 2026) at Tesla",
    company: "Tesla",
    location: "Palo Alto, CA",
    isRemote: false,
    description: "",
    url: "https://ev.careers/jobs/a26-01",
    postedAt: "2026-08-01T12:00:00.000Z",
    tags: ["Battery"],
    score: 0.9,
    matchedKeywords: ["battery"],
    matchReason: "Matches your battery research focus.",
  };

  it("renders the title once and leaves the employer field intact", () => {
    const job = scoredJobToJob(base);
    expect(job.roleTitle).toBe("Internship, Battery Engineering (Summer 2026)");
    // THE EMPLOYER FIELD IS READ, NEVER WRITTEN. 62d(a) is not reopened.
    expect(job.companyOrLab).toBe("Tesla");
  });

  it("leaves a title whose employer clause is NOT redundant alone", () => {
    // The same shape with no company field — the clause is then the reader's
    // only source of the employer and must survive. This is the live-common
    // case: 40 of B's 43 rendered rows.
    const job = scoredJobToJob({ ...base, company: undefined });
    expect(job.roleTitle).toBe(
      "Internship, Battery Engineering (Summer 2026) at Tesla",
    );
    expect(job.companyOrLab).toBeUndefined();
  });

  /**
   * **THE ORDERING CONSTRAINT (B5-07/R4), LOCKED.** `summarizeJob(...)` takes
   * `roleTitle` as its title-echo check and DROPS any sentence that ends by
   * echoing the title (`summarize.ts:348` → `return null`). The strip therefore
   * lands on the returned FIELD and must not be substituted before that call:
   * feeding the shortened title would stop the echo matching and let the junk
   * sentence through.
   *
   * The body below ends with a sentence that echoes the FULL, UNSTRIPPED title.
   * If the call site is ever moved above `summarizeJob`, that sentence starts
   * appearing in the summary and this test goes red.
   */
  it("still hands summarizeJob the UNSTRIPPED title, so the echo check keeps working", () => {
    const job = scoredJobToJob({
      ...base,
      fetchedPostingScope: "owned",
      pageText:
        "You will build solid-state battery cells for a growing research team. "
        + "You will analyze electrochemical experiments and publish the findings. "
        + "Opening For Internship, Battery Engineering (Summer 2026) at Tesla.",
    });
    expect(job.summary).toBeTruthy();
    expect(job.summary).not.toContain("Opening For");
    // and the field itself is still the stripped one
    expect(job.roleTitle).toBe("Internship, Battery Engineering (Summer 2026)");
  });
});
