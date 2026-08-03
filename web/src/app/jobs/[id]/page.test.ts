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
    expect(html).toContain("$120k / yr");
    expect(html).toContain("Jul 20, 2026");
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
    expect(html).not.toContain("Skills and profile gaps");
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
    expect(html).toContain("Because you often view California roles");
    expect(why).toBeLessThan(html.indexOf("Also in this report with an AI key"));
    expect(html.indexOf("To apply, have ready")).toBeLessThan(why);
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
    // The tile says "Sponsors", the header chip says "Sponsorship available".
    // Different words on purpose, so the same fact is not printed twice.
    expect(html.match(/Sponsorship available/g)).toHaveLength(1);
    expect(html).toContain("The laboratory will provide H-1B sponsorship.");
    // The plate's two countdowns, which appeared nowhere in the report before.
    expect(html).toContain("in 2 weeks");
    expect(html).toContain("10d ago");
    // The rest of the plate's sub-lines.
    expect(html).toContain("per year · from posting");
    expect(html).toContain("stated in the posting");
    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuenow="67"');

    // Plate 02 order: Timeline, then Skills, then the two-column role block.
    // "Why Peer sent it" was deleted in P10.4.
    const timeline = html.indexOf("Timeline");
    const skills = html.indexOf("Skills and profile gaps");
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
    expect(timelineSection).toContain("Posted");
    expect(timelineSection).toContain("Jul 20, 2026");
    expect(timelineSection).toContain("Today");
    expect(timelineSection).toContain("Jul 30, 2026");
    expect(timelineSection).toContain("Apply by");
    expect(timelineSection).toContain("Aug 15, 2026");
    expect(timelineSection).toContain("Starts");
    expect(timelineSection).toContain("Oct 1, 2026");
    expect(timelineSection).not.toContain("Skills and profile gaps");
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
    expect(appliedHtml).toContain(">Applied<");
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

    expect(html).toContain("Skills and profile gaps");
    expect(html).toContain("0 of 2 requirements match terms in your profile");
    expect(
      html.match(/data-skill-requirement="unmatched"/g),
    ).toHaveLength(2);
    expect(html).toContain("Experience with battery cyclers");
    expect(html).toContain("Statistical experiment design");
  });

  it("omits the skills section and header when no requirements exist", () => {
    const html = renderReport(
      baseJob({ keyRequirements: [" ", "\t"], matchedTerms: ["Python"] }),
    );

    expect(html).not.toContain("Skills and profile gaps");
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
