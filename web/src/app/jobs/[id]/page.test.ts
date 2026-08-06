import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Job } from "@/types";
import type {
  JobEnrichment,
  OpportunityPageReadingReason,
} from "@/lib/opportunities/enrichment";
import { JobReport } from "./page";

const NOW = Date.parse("2026-07-30T12:00:00Z");

function renderReport(
  job: Job,
  isApplied = false,
  enrichment: JobEnrichment | null = null,
  providerConfigured = false,
  isInterested = false,
  pageReadingReason?: OpportunityPageReadingReason,
): string {
  return renderToStaticMarkup(
    createElement(JobReport, {
      job,
      isSaved: false,
      isApplied,
      isInterested,
      nowMs: NOW,
      enrichment,
      pageReadingReason,
      providerConfigured,
      onToggleSave: () => undefined,
      onAppliedChange: () => undefined,
      onDismiss: () => undefined,
    }),
  );
}

function baseJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job:1",
    roleTitle: "Battery Research Scientist",
    companyOrLab: "Example Energy",
    location: "Chicago, IL",
    isRemote: false,
    keyRequirements: [],
    matchReason: "",
    ...overrides,
  };
}

describe("JobReport", () => {
  it("renders one wrapping action row with the paired feedback controls", () => {
    const html = renderReport(
      baseJob({ linkPosting: "https://jobs.example.test" }),
      false,
      null,
      false,
      true,
    );
    const actionRows = html.match(
      /<div[^>]*data-report-action-row="job"[^>]*>/g,
    );
    const interested = html.match(
      /<button[^>]*data-feedback-control="interested"[^>]*>/,
    )?.[0];

    expect(actionRows).toHaveLength(1);
    expect(actionRows?.[0]).toContain("flex flex-wrap items-center");
    expect(html.match(/data-opportunity-feedback-pair="true"/g)).toHaveLength(1);
    expect(interested).toContain('aria-pressed="true"');
    expect(html).toContain("Interested");
    expect(html).toContain("Not interested");
  });

  it("renders a sparse aggregator job without empty facts or placeholders", () => {
    const html = renderReport(
      baseJob({
        salary: {
          min: 120_000,
          max: 120_000,
          currency: "USD",
          period: "year",
        },
        postedDate: "2026-07-20",
      }),
    );

    expect(html).toContain("Battery Research Scientist");
    expect(html).toContain("Example Energy");
    expect(html).toContain("Chicago, IL");
    // B2-02. The SALARY tile used to print the period twice — once in the
    // value's own "/ yr" suffix, again in the detail line below. The tile
    // value is now formatSalaryRange's plain range; "per year" lives only in
    // the detail line (asserted further down as "per year · from posting").
    expect(html).toContain("$120k");
    expect(html).not.toContain("$120k / yr");
    // B2-01: report dates inside their own one-year horizon drop the year.
    expect(html).toContain("Jul 20");
    expect(html).not.toContain("Jul 20, 2026");
    // B-06 changed this from 2 to 3. Plate 02 has a LOCATION tile, which the
    // build only ever built for remote jobs; baseJob is in Chicago, so a
    // sparse job now correctly shows where the work is.
    expect(html.match(/data-job-fact=/g)).toHaveLength(3);
    expect(html).toContain('data-job-fact="salary"');
    expect(html).toContain('data-job-fact="posted"');
    expect(html).toContain('data-job-fact="work-mode"');
    expect(html).not.toMatch(/<dd[^>]*>\s*<\/dd>/);
    expect(html).not.toContain("—");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
    expect(html.toLowerCase()).not.toContain("not listed");
    // B-10 renamed the heading to plate 02's "Skills they ask for".
    expect(html).not.toContain("Skills they ask for");
    expect(html).not.toContain("What the role is");
    expect(html).not.toContain("What to have ready");
    expect(html).not.toContain("Why Peer sent it");
    expect(html).not.toContain("Visa");
    expect(html).not.toContain("Apply by");
    expect(html).not.toContain("Starts");
  });

  it("renders Why Peer sent this to you as the last block before the locked block", () => {
    // B-03 / §1b Correction 2. P10.4 deleted this Tier 0 block from both
    // reports on the grounds it was a one-line restatement; plate 02 shows a
    // substantive paragraph. Restored at the plate's heading — note the old
    // wording "Why Peer sent it" must stay gone, and two assertions above
    // still pin its absence.
    const html = renderReport(
      baseJob({
        matchReason:
          "Matches your solid-state electrolytes focus · fits a postdoc profile",
        facetPreferenceReason: "Because you often view California roles",
      }),
    );

    const why = html.indexOf("Why Peer sent this to you");
    expect(why).toBeGreaterThan(-1);
    expect(html).not.toContain("Why Peer sent it");
    expect(html).toContain(
      "Matches your solid-state electrolytes focus · fits a postdoc profile",
    );
    // B2-08 / Ruling 12. The plate prints ONE sentence, not two paragraphs.
    // facetReason's own "Because ..." lower-cases to a trailing clause when
    // it follows body text, rather than starting a fresh sentence.
    expect(html).toContain("because you often view California roles.");
    expect(html).not.toContain("Because you often view California roles");
    expect(why).toBeLessThan(html.indexOf("Also in this report with an AI key"));
    expect(html.indexOf("To apply, have ready")).toBeLessThan(why);
    // B2-07 / Ruling 11. Plate 02 badges this heading TIER 0.
    const whySection = html.match(
      /<section[^>]*data-report-section="why-peer-sent-this"[^>]*>[\s\S]*?<\/section>/,
    )?.[0];
    expect(whySection).toContain("Tier 0");
  });

  it("hides Why Peer sent this to you when the scoring layer produced nothing", () => {
    // B-03. The block prints what exists and stops — it is never padded with
    // invented specifics to reach the plate's fuller sentence.
    const html = renderReport(baseJob({ matchReason: "" }));
    expect(html).not.toContain("Why Peer sent this to you");
  });

  it("renders all seven supported facts and the rich report in order", () => {
    const html = renderReport(
      baseJob({
        isRemote: true,
        roleKind: "staff",
        contractLength: "Two-year fixed-term appointment",
        employmentType: "full-time",
        salary: {
          min: 120_000,
          max: 150_000,
          currency: "USD",
          period: "year",
        },
        postedDate: "2026-07-20",
        applicationDeadline: "2026-08-15",
        startDate: "2026-10-01",
        visa: {
          state: "sponsors",
          evidence: "The laboratory will provide H-1B sponsorship.",
          country: "United States",
        },
        relevanceScore: 0.91,
        keyRequirements: ["Electrochemistry", "Python", "Scale-up"],
        matchedTerms: ["electrochemistry", "python"],
        summary: "Lead applied research on solid-state battery interfaces.",
        applicationMaterials: ["CV", "Cover letter"],
        matchReason: "Matches your declared solid-state battery focus.",
        linkPosting: "https://jobs.example.com/1",
      }),
    );

    // B-06. This test has been named "all seven supported facts" while
    // asserting six since it was written. Plate 02 has seven tiles and the
    // build now renders all seven: the missing two were LOCATION (built only
    // for remote jobs) and VISA (in the key union but never pushed).
    expect(html.match(/data-job-fact=/g)).toHaveLength(7);
    expect(html).toContain('data-job-fact="visa"');
    expect(html).toContain('data-job-fact="work-mode"');
    // B2-04. The tile says "Sponsors", the header chip says "Visa
    // sponsorship" (renamed from "Sponsorship available", which never
    // matched the plate). Different words on purpose, so the same fact is
    // not printed twice.
    expect(html.match(/Visa sponsorship/g)).toHaveLength(1);
    expect(html).not.toContain("Sponsorship available");
    expect(html).toContain("The laboratory will provide H-1B sponsorship.");
    // B2-03 + B2-04. humanize() keeps "full-time" as one hyphenated word, and
    // the header chip / TYPE tile detail now state the SAME expanded
    // contract length ("Two-year fixed-term appointment" -> "2 years") in
    // two phrasings — the chip states it in full, the tile abbreviates it —
    // rather than each printing a different fragment of the raw scraped text.
    expect(html).toContain("Full-time · 2 years"); // header chip
    expect(html).toContain("Full-time · 2-yr contract"); // TYPE tile detail
    expect(html).not.toContain("Full Time");
    expect(html).not.toContain("Two-year fixed-term appointment");
    // The plate's two countdowns, which appeared nowhere in the report before.
    // B2-01 rewrote these from the feed's vocabulary ("in 2 weeks", "10d ago")
    // to the plate's own ("16 days left", "10 days ago") — always days, never
    // bucketed into weeks, never abbreviated.
    expect(html).toContain("16 days left");
    expect(html).toContain("10 days ago");
    // The rest of the plate's sub-lines.
    expect(html).toContain("per year · from posting");
    expect(html).toContain("stated in the posting");
    // B2-02. Plate 02's SALARY value: spaced en dash, currency repeated on the
    // upper bound, no period suffix — the period lives in the detail line above.
    expect(html).toContain("$120k – $150k");
    expect(html).not.toContain("$120k–150k");
    expect(html).not.toContain("/ yr");
    // B-10 removed the progress bar. Plate 02 does not have one, and
    // say-it-once already gives the ratio in the count line below it.
    expect(html).not.toContain('role="progressbar"');
    expect(html).toContain("2 of 3 you already have");

    // Plate 02 order: Timeline, then Skills, then the two-column role block.
    // "Why Peer sent it" was deleted in P10.4.
    const timeline = html.indexOf("Timeline");
    const skills = html.indexOf("Skills they ask for");
    const role = html.indexOf("What the role is");
    const materials = html.indexOf("To apply, have ready");
    expect(timeline).toBeGreaterThan(-1);
    expect(timeline).toBeLessThan(skills);
    expect(skills).toBeLessThan(role);
    expect(role).toBeLessThan(materials);
    expect(html).not.toContain("Why Peer sent it");
    expect(html).not.toContain("What to have ready");

    const timelineSection = html.match(
      /<section[^>]*data-job-section="timeline"[^>]*>[\s\S]*?<\/section>/,
    )?.[0];
    // B2-01. Plate 02's own Timeline reads "Posted Jul 22" / "Today" /
    // "Deadline Sep 15" / "Start Jan 2027" — no year except on the
    // month/year-only Start point, and no day-of-month there either.
    expect(timelineSection).toContain("Posted");
    expect(timelineSection).toContain("Jul 20");
    expect(timelineSection).not.toContain("Jul 20, 2026");
    // B3-02. The plate's Today point is the bare word with nothing
    // underneath — it is the anchor the other three points are measured
    // against, not a fourth date. No date renders under it any more.
    expect(timelineSection).toContain("Today");
    expect(timelineSection).not.toContain("Jul 30");
    // B3-02. Timeline's own label reads "Deadline", not "Apply by" — the
    // facts-row APPLY BY tile a few hundred lines above keeps its own label,
    // this assertion is scoped to timelineSection so it cannot collide with it.
    expect(timelineSection).toContain("Deadline");
    expect(timelineSection).not.toContain("Apply by");
    expect(timelineSection).toContain("Aug 15");
    expect(timelineSection).not.toContain("Aug 15, 2026");
    // B3-02. Timeline's own label reads "Start", not "Starts" — "Start" is a
    // substring of "Starts", so also assert the old word is gone entirely
    // rather than relying on a `.toContain("Start")` that would pass either way.
    expect(timelineSection).toContain("Start");
    expect(timelineSection).not.toMatch(/Starts\b/);
    expect(timelineSection).toContain("Oct 2026");
    expect(timelineSection).not.toContain("Oct 1, 2026");
    expect(timelineSection).not.toContain("Skills they ask for");
  });

  it("keeps the hyphen inside a hyphenated employment type", () => {
    // B2-03. Same bug class as B-12's activity-label mangling: a formatter
    // written for slugs stripped every hyphen before title-casing, so
    // "full-time" — one hyphenated word — split into two capitalised words,
    // "Full Time". Underscores are a genuine slug separator and do become
    // spaces; hyphens are not slugs and stay put.
    const html = renderReport(baseJob({ employmentType: "full-time" }));
    expect(html).toContain('data-job-fact="employment-type"');
    expect(html).toContain(">Full-time<");
    expect(html).not.toContain("Full Time");

    const underscoreHtml = renderReport(
      baseJob({ employmentType: "part_time" }),
    );
    expect(underscoreHtml).toContain("Part time");
  });

  it("expands a worded contract duration for the chip and abbreviates it for the tile", () => {
    // B2-04 / Ruling 9. One field, two formatters. "3-year fixed-term
    // position" expands to "3 years" for the header chip and abbreviates from
    // that same value to "3-yr contract" for the TYPE tile — never two
    // independent reads of the raw scraped text. roleKind is set so the tile's
    // detail line states the employment type too, matching the header chip's
    // shape exactly (without it, the tile's own value already says "Full-time"
    // and the detail need not repeat it).
    const html = renderReport(
      baseJob({
        roleKind: "staff",
        employmentType: "full-time",
        contractLength: "3-year fixed-term position",
      }),
    );
    expect(html).toContain("Full-time · 3 years"); // header chip
    expect(html).toContain("Full-time · 3-yr contract"); // TYPE tile detail
    expect(html).not.toContain("fixed-term position");
  });

  it("never invents a duration when the contract length doesn't parse", () => {
    // B2-04. Text with no "<number> year(s)/month(s)" anywhere prints back
    // verbatim in both places rather than guessing at a duration.
    const html = renderReport(
      baseJob({
        roleKind: "staff",
        employmentType: "full-time",
        contractLength: "Renewable annually",
      }),
    );
    expect(html.match(/Renewable annually/g)).toHaveLength(2);
  });

  it("prints STARTS at month/year only, with no invented sub-line", () => {
    // B2-05. The granularity half (no day-of-month) landed with B2-01. The
    // plate's "flexible" sub-line states whether the start date is
    // negotiable — Job has no such field, so this is excluded under the
    // same "no field exists" category as (c)-(h), item (i): the tile stays
    // silent rather than inventing a detail to fill the slot.
    const html = renderReport(baseJob({ startDate: "2026-10-01" }));
    const startTile = html.match(
      /<div[^>]*data-job-fact="start"[^>]*>[\s\S]*?<\/div>/,
    )?.[0];
    expect(startTile).toContain("Oct 2026");
    expect(startTile).not.toContain("Oct 1");
    expect(startTile).not.toContain("data-report-fact-detail");
  });

  it("shows the posting's own work mode in the LOCATION tile and the subtitle", () => {
    // B2-06. Job carried only isRemote, which cannot express "hybrid". The
    // new workMode field is additive — set only from a signal the posting
    // actually gave — and both plate locations (the LOCATION tile's sub-line,
    // the subtitle's third segment) now read it, falling back to the old
    // isRemote-only behaviour when it is unset.
    const hybridHtml = renderReport(
      baseJob({ location: "Los Altos, CA", workMode: "hybrid" }),
    );
    const locationTile = hybridHtml.match(
      /<div[^>]*data-job-fact="work-mode"[^>]*>[\s\S]*?<\/div>/,
    )?.[0];
    expect(locationTile).toContain("Hybrid");
    const subtitle = hybridHtml.match(
      /<p class="mt-3 text-body text-text-muted">[\s\S]*?<\/p>/,
    )?.[0];
    expect(subtitle).toContain("Los Altos, CA");
    expect(subtitle).toContain(">Hybrid<");

    const onSiteHtml = renderReport(baseJob({ workMode: "on-site" }));
    expect(onSiteHtml).toContain("On-site");

    // Unset workMode falls back to isRemote exactly as before B2-06.
    const remoteFallbackHtml = renderReport(baseJob({ isRemote: true }));
    expect(remoteFallbackHtml).toContain("Remote");
  });

  it("renders the Applied control in both inactive and completed states", () => {
    const pendingHtml = renderReport(baseJob(), false);
    const appliedHtml = renderReport(baseJob(), true);
    const pendingButton = pendingHtml.match(
      /<button[^>]*data-completion-control="applied"[^>]*>/,
    )?.[0];
    const appliedButton = appliedHtml.match(
      /<button[^>]*data-completion-control="applied"[^>]*>/,
    )?.[0];

    expect(pendingButton).toContain('aria-pressed="false"');
    expect(appliedButton).toContain('aria-pressed="true"');
    expect(appliedButton).toContain("bg-done-dim");
    // B-18. Plate 02 labels this "Mark as applied" — the control is an action,
    // not a status. The hook it is found by is `controlKey`, which no longer
    // moves when the copy does.
    expect(appliedHtml).toContain(">Mark as applied<");
  });

  it("lists both requirements behind a zero-of-two skills count", () => {
    const html = renderReport(
      baseJob({
        keyRequirements: [
          "Experience with battery cyclers",
          "Statistical experiment design",
        ],
        matchedTerms: [],
      }),
    );

    // B-10 rewrote the heading and the count copy to plate 02's wording.
    expect(html).toContain("Skills they ask for");
    expect(html).toContain("0 of 2 you already have");
    expect(
      html.match(/data-skill-requirement="unmatched"/g),
    ).toHaveLength(2);
    expect(html).toContain("Experience with battery cyclers");
    expect(html).toContain("Statistical experiment design");
  });

  it("refuses to call site chrome a skill the reader is missing", () => {
    // B-10. Scraped keyRequirements come from item.tags, which is filtered
    // only by length upstream, so "tesla.com" and "Sign in" reached the field
    // intact — and the report listed them under "Not matched in your profile",
    // telling the reader they lacked a skill called Sign in.
    //
    // The guard sits at the report layer on purpose: item.tags also feeds
    // cards, search and the preference ledger, and tightening it upstream
    // would change ranking.
    const html = renderReport(
      baseJob({
        keyRequirements: [
          "web job listing",
          "tesla.com",
          "Apply now",
          "Sign in",
          "Solid-state electrolytes",
          "careers page",
        ],
        matchedTerms: [],
      }),
    );

    expect(html.match(/data-skill-requirement=/g)).toHaveLength(1);
    expect(html).toContain("Solid-state electrolytes");
    expect(html).toContain("0 of 1 you already have");
    for (const junk of ["tesla.com", "Apply now", "Sign in", "careers page"]) {
      expect(html).not.toContain(`>${junk}<`);
    }
  });

  it("hides the skills section when only site chrome was scraped", () => {
    // B-10. An empty chip row under a heading promising skills is worse than
    // no section, so skillComparison returns null when nothing survives.
    const html = renderReport(
      baseJob({ keyRequirements: ["Apply now", "https://tesla.com/careers"] }),
    );

    expect(html).not.toContain("Skills they ask for");
    expect(html).not.toContain("data-skill-requirement");
  });

  it("shows the chips in one row with the plate's footnote", () => {
    // B-10. Plate 02 has ONE flat wrapping row — matched chips highlighted
    // with a trailing tick, gaps plain, same row. The build split them into
    // two columns under "Matched in your profile" / "Not matched in your
    // profile", which turned a glance into a comparison exercise.
    const html = renderReport(
      baseJob({
        keyRequirements: ["Electrochemistry", "Python", "Scale-up"],
        matchedTerms: ["electrochemistry"],
      }),
    );

    expect(html).not.toContain("Matched in your profile");
    expect(html).not.toContain("Not matched in your profile");
    expect(html.match(/data-skill-requirement="matched"/g)).toHaveLength(1);
    expect(html.match(/data-skill-requirement="unmatched"/g)).toHaveLength(2);
    // Matched chips come first, so the row reads as "what you have, then the
    // gaps" rather than in scrape order.
    expect(html.indexOf('data-skill-requirement="matched"')).toBeLessThan(
      html.indexOf('data-skill-requirement="unmatched"'),
    );
    expect(html).toContain(
      "Highlighted chips come from your Required and Explore topics plus your project text. The plain ones are the gaps — worth seeing before you spend an evening on the application.",
    );
  });

  it("omits the skills section and header when no requirements exist", () => {
    const html = renderReport(
      baseJob({ keyRequirements: [" ", "\t"], matchedTerms: ["Python"] }),
    );

    expect(html).not.toContain("Skills they ask for");
    expect(html).not.toContain("data-skill-requirement");
  });

  it("cleans stale cached title, subtitle, and description artifacts", () => {
    const html = renderReport(
      baseJob({
        roleTitle: "…Battery Research Internship",
        companyOrLab: "Apply now!",
        summary:
          "The lab values careful experiments. ] Tasks: Run battery diagnostics and document the results.",
      }),
    );

    expect(html).toContain("Battery Research Internship");
    expect(html).not.toContain("…Battery Research Internship");
    expect(html).not.toContain("Apply now!");
    expect(html).not.toContain("] Tasks");
    expect(html).toContain("Tasks: Run battery diagnostics");
  });

  it("renders the two quoted specifics with all four AI sections and hides the locked block", () => {
    const html = renderReport(
      baseJob({
        summary: "The posting says this role leads battery interface experiments.",
        visa: { state: "not-stated", evidence: "Sponsorship is not mentioned." },
      }),
      false,
      {
        specificRequirements: [
          "A PhD in electrochemistry or a related field is required.",
        ],
        specificDuties: [
          "Design and run solid-state interface experiments.",
        ],
        competitiveness: { verdict: "Strong match", reasoning: "Methods align." },
        sponsorshipRead: {
          likelihood: "Plausible",
          basis: "This is an inference from comparable roles.",
        },
        roleSummary: ["First sentence.", "Second sentence.", "Third sentence."],
        emphasise: ["Lead with interface work.", "Name the impedance method."],
      },
    );

    // P10.2 merged the two role sections into one bulleted block, and P10.6
    // deleted the competitiveness verdict outright — Peer presents, the user judges.
    const requirements = html.indexOf("What this employer actually asks for");
    const duties = html.indexOf("What the person would actually do");
    const sponsorship = html.indexOf("Sponsorship read");
    const emphasise = html.indexOf("What to emphasise in your application");
    const role = html.indexOf("What the role is");
    expect(role).toBeGreaterThan(-1);
    expect(role).toBeLessThan(requirements);
    expect(requirements).toBeLessThan(duties);
    expect(duties).toBeLessThan(sponsorship);
    expect(sponsorship).toBeLessThan(emphasise);
    expect(html).not.toContain("How competitive this actually is");
    expect(html).not.toContain("The role in three clean sentences");
    // The merged block prints the model's sentences as bullets, exactly once.
    expect(html).toContain("First sentence.");
    expect((html.match(/First sentence\./g) ?? []).length).toBe(1);
    expect(html).toContain("Posting evidence");
    expect(html).toContain(
      "A PhD in electrochemistry or a related field is required.",
    );
    expect(html).toContain(
      "Design and run solid-state interface experiments.",
    );
    expect(html).toContain("Peer inference — verify with the employer");
    expect(html).not.toContain("Also in this report with an AI key");
  });

  it("does not render or unlock empty quoted-specific sections", () => {
    const html = renderReport(
      baseJob(),
      false,
      { specificRequirements: [], specificDuties: [] },
      true,
    );

    expect(html).not.toContain('data-job-section="specific-requirements"');
    expect(html).not.toContain('data-job-section="specific-duties"');
    // P10.9: the reader has a key, so no upgrade pitch — an explanation instead.
    expect(html).not.toContain("Also in this report with an AI key");
  });

  it("renders and unlocks either quoted-specific section independently", () => {
    const requirementsHtml = renderReport(
      baseJob(),
      false,
      { specificRequirements: ["A doctorate in chemistry is required."] },
      false,
      false,
      "read-failed",
    );
    const dutiesHtml = renderReport(
      baseJob(),
      false,
      { specificDuties: ["Lead weekly cell-testing reviews."] },
      false,
      false,
      "read-failed",
    );

    expect(requirementsHtml).toContain("What this employer actually asks for");
    expect(requirementsHtml).toContain("A doctorate in chemistry is required.");
    expect(requirementsHtml).not.toContain('data-job-section="specific-duties"');
    expect(requirementsHtml).not.toContain("Also in this report with an AI key");
    expect(requirementsHtml).not.toContain("data-page-reading-note");
    expect(dutiesHtml).toContain("What the person would actually do");
    expect(dutiesHtml).toContain("Lead weekly cell-testing reviews.");
    expect(dutiesHtml).not.toContain(
      'data-job-section="specific-requirements"',
    );
    expect(dutiesHtml).not.toContain("Also in this report with an AI key");
    expect(dutiesHtml).not.toContain("data-page-reading-note");
  });

  it("never sells a key to someone who already has one", () => {
    // P10.9. A configured key that produced nothing gets an explanation, never
    // an upgrade pitch — the old screen told the reader to connect a key at the
    // exact moment they were checking whether their key worked.
    const withKey = renderReport(baseJob(), false, null, true, false, "read-failed");
    expect(withKey).not.toContain("Also in this report with an AI key");
    expect(withKey).toContain(
      "Peer could not finish reading the job posting this time.",
    );

    const withoutKey = renderReport(baseJob(), false, null, false, false, "no-provider");
    expect(withoutKey).toContain("Also in this report with an AI key");
    expect(withoutKey).not.toContain("data-page-reading-note");
  });

  it.each([
    [
      "no-quotable-details",
      "Peer read the job posting but found no requirements or duties it could quote.",
    ],
    [
      "read-failed",
      "Peer could not finish reading the job posting this time.",
    ],
  ] as const)(
    "renders only the %s job-posting note",
    (pageReadingReason, sentence) => {
      const html = renderReport(
        baseJob(),
        false,
        { emphasise: ["Lead with the interface work."] },
        true,
        false,
        pageReadingReason,
      );
      const allSentences = [
        "Peer read the job posting but found no requirements or duties it could quote.",
        "Peer could not finish reading the job posting this time.",
      ];

      expect(html.match(/data-page-reading-note="job"/g)).toHaveLength(1);
      expect(html).toContain(sentence);
      for (const other of allSentences.filter((item) => item !== sentence)) {
        expect(html).not.toContain(other);
      }
    },
  );
});
