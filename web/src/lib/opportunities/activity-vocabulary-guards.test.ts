import { describe, expect, it } from "vitest";
import { extractEventDetails } from "@/lib/opportunities/event-details";

// Reviewer probe. Every phrase below is real research/marketing prose that a
// conference or paper page would plausibly contain. None of them describes a
// programme item, so none may produce an activity tag.
const FALSE_POSITIVES: Array<[string, string]> = [
  ["panel", "We report a solar panel with 26% efficiency under AM1.5G."],
  ["panel", "The panel data were analysed with a fixed-effects estimator."],
  ["panel", "A flat-panel display driven by oxide thin-film transistors."],
  ["panel", "The control panel is mounted on the reactor housing."],
  ["networking", "Papers on wireless networking and network-on-chip design."],
  ["networking", "Advances in networking protocols for 6G backhaul."],
  ["networking", "Social networking data were collected from public feeds."],
  ["exhibition", "The sample exhibits high conductivity above 300 K."],
  ["exhibition", "The alloy exhibits a martensitic transformation."],
  ["school", "Authors are with the School of Engineering, Tsinghua University."],
  ["school", "She completed graduate school before joining the lab."],
  ["school", "Outreach activities were run with a local high school."],
  ["competition", "Grand challenges in energy storage remain unsolved."],
  ["competition", "The key challenge is dendrite suppression at high rate."],
  ["competition", "Competition between phases governs the microstructure."],
  ["awards ceremony", "This work was supported by NSF award number 2145678."],
  ["awards ceremony", "The award-winning group published three papers."],
  ["awards ceremony", "A grant award was made to the consortium in 2024."],
  ["social event", "Applications across the social sciences are discussed."],
  ["social event", "Social determinants of health were controlled for."],
  ["social event", "Social media sentiment was used as a covariate."],
  ["banquet", "Reception studies in classical literature are reviewed."],
  ["banquet", "Signal reception degrades beyond 40 metres."],
  ["lightning talk", "Lightning detection networks recorded 400 strikes."],
  ["lightning talk", "Flash sintering of zirconia was achieved at 900 C."],
  ["lightning talk", "Flash memory endurance exceeded 10^5 cycles."],
  ["lightning talk", "Flash chromatography was used to purify the product."],
  ["field trip", "The magnetic field was swept from 0 to 9 T."],
  ["field trip", "A field-effect transistor with a hafnia gate stack."],
  ["field trip", "Recent progress in the field of topological materials."],
  ["short course", "In the course of the reaction, the pH drops sharply."],
  ["short course", "Of course, the approximation breaks down at low T."],
  ["field trip", "A temperature excursion above 80 C degraded the cell."],
  ["field trip", "The pH excursion was corrected within two minutes."],
  ["doctoral consortium", "The ENCODE Consortium released the annotation."],
  ["doctoral consortium", "Consortium partners contributed sequencing data."],
  ["demo session", "We demonstrate a novel route to single-crystal LCO."],
  ["demo session", "The demonstrated capacity retention exceeds 90%."],
  ["hands-on session", "Students gain hands-on experience in our facility."],
  ["tutorial", "This tutorial review covers ion-exchange thermodynamics."],
  ["field trip", "A guided tour de force through modern optics."],
];

// Real programme sentences. Each MUST still produce its tag, otherwise the
// guards were tightened into uselessness.
const TRUE_POSITIVES: Array<[string, string]> = [
  ["plenary", "Plenary Sessions open each morning in Hall A."],
  ["awards ceremony", "The awards ceremony takes place on Thursday evening."],
  ["competition", "The student paper competition closes on 1 March."],
  ["short course", "Two short courses run on the Sunday before the meeting."],
  ["demo session", "The demo session showcases live hardware in Hall C."],
  ["doctoral consortium", "A doctoral consortium is held for PhD students."],
  ["banquet", "The conference banquet is ticketed separately."],
  ["social event", "Social events are listed in the programme overview."],
  ["lightning talk", "Lightning talks are limited to three minutes each."],
  ["field trip", "A field trip to the coastal site runs on Friday."],
  ["school", "A summer school precedes the main conference."],
  ["town hall", "A town hall on open access is scheduled for Wednesday."],
  ["meet the expert", "Meet the expert sessions run daily at lunchtime."],
  ["hands-on session", "Hands-on sessions require a laptop with Python."],
  ["panel", "A panel discussion on funding closes the second day."],
  ["networking", "A networking reception follows the poster session."],
  ["poster session", "The poster session runs from 17:00 to 19:00."],
  ["exhibition", "The exhibition hall opens at 09:00 with 80 exhibitors."],
  ["keynote", "The opening keynote is delivered by the society president."],
  ["workshop", "Six workshops run in parallel on the final day."],
  ["career fair", "A career fair connects students with 30 employers."],
];

function tags(sentence: string): string[] {
  return extractEventDetails(`<main><p>${sentence}</p></main>`).activities ?? [];
}

describe("false positives from the 53-site research", () => {
  for (const [label, sentence] of FALSE_POSITIVES) {
    it(`[${label}] must NOT fire on: ${sentence}`, () => {
      expect(tags(sentence)).not.toContain(label);
    });
  }
});

describe("real programme sentences still tag", () => {
  for (const [label, sentence] of TRUE_POSITIVES) {
    it(`[${label}] must fire on: ${sentence}`, () => {
      expect(tags(sentence)).toContain(label);
    });
  }
});

describe("structural rules", () => {
  it("does not emit mixer for any wording", () => {
    for (const s of ["A mixer follows the reception.", "An RF mixer was used."]) {
      expect(tags(s)).not.toContain("mixer");
    }
  });

  it("folds flash talk and short talk into the lightning talk tag", () => {
    expect(tags("Flash talks are five minutes long.")).toContain("lightning talk");
    expect(tags("Short talks are scheduled after lunch.")).toContain("lightning talk");
    expect(tags("Flash talks are five minutes long.")).not.toContain("flash talk");
  });

  it("folds technical tour into the field trip tag", () => {
    expect(tags("A technical tour of the fab is offered.")).toContain("field trip");
  });

  it("only tags an excursion in a programme context, never in prose", () => {
    // Deliberate: bare "excursions" stays unmatched because "temperature
    // excursion" and "pH excursion" are ordinary process-engineering prose.
    expect(tags("A temperature excursion above 80 C degraded the cell."))
      .not.toContain("field trip");
    expect(
      extractEventDetails("<main><h2>Excursions</h2><p>Book at registration.</p></main>")
        .activities ?? [],
    ).toContain("field trip");
  });
});
