import { describe, expect, it } from "vitest";
import { extractVisaState } from "./visa";

describe("extractVisaState", () => {
  describe("United States", () => {
    it("detects sponsorship", () => {
      expect(
        extractVisaState(
          "The university will provide H-1B sponsorship for this role.",
          "USA",
        ),
      ).toEqual({
        state: "sponsors",
        evidence: "The university will provide H-1B sponsorship for this role.",
        country: "United States",
      });
    });

    it("detects a requirement for existing authorisation", () => {
      expect(
        extractVisaState(
          "Applicants must be currently authorized to work in the United States.",
          "United States",
        ),
      ).toEqual({
        state: "wont-sponsor",
        evidence:
          "Applicants must be currently authorized to work in the United States.",
        country: "United States",
      });
    });

    it("returns not-stated when no scoped phrase appears", () => {
      expect(
        extractVisaState(
          "This role develops solid-state battery materials.",
          "United States",
        ),
      ).toEqual({
        state: "not-stated",
        country: "United States",
      });
    });
  });

  describe("United Kingdom", () => {
    it("detects Skilled Worker sponsorship", () => {
      expect(
        extractVisaState(
          "Skilled Worker visa sponsorship is available for this appointment.",
          "UK",
        ),
      ).toEqual({
        state: "sponsors",
        evidence:
          "Skilled Worker visa sponsorship is available for this appointment.",
        country: "United Kingdom",
      });
    });

    it("detects an existing right-to-work requirement", () => {
      expect(
        extractVisaState(
          "Candidates must already have the right to work in the UK.",
          "United Kingdom",
        ),
      ).toEqual({
        state: "wont-sponsor",
        evidence: "Candidates must already have the right to work in the UK.",
        country: "United Kingdom",
      });
    });

    it("returns not-stated when no scoped phrase appears", () => {
      expect(
        extractVisaState("The post is based in Oxford.", "United Kingdom"),
      ).toEqual({
        state: "not-stated",
        country: "United Kingdom",
      });
    });
  });

  it("lets role-specific refusal win over general sponsorship language", () => {
    const result = extractVisaState(
      [
        "We sponsor visas for some roles.",
        "This role requires existing authorisation to work in the UK.",
      ].join(" "),
      "United Kingdom",
    );

    expect(result).toEqual({
      state: "wont-sponsor",
      evidence: "This role requires existing authorisation to work in the UK.",
      country: "United Kingdom",
    });
  });

  it("does not flag a US internship that accepts CPT or OPT", () => {
    const result = extractVisaState(
      [
        "This summer research internship welcomes students eligible for CPT or OPT.",
        "The laboratory cannot provide visa sponsorship.",
      ].join(" "),
      "United States",
    );

    expect(result).toEqual({
      state: "not-stated",
      evidence:
        "This summer research internship welcomes students eligible for CPT or OPT.",
      country: "United States",
    });
  });

  it("does not apply the CPT or OPT exception outside the US", () => {
    expect(
      extractVisaState(
        "This UK internship welcomes students with OPT, but we cannot provide visa sponsorship.",
        "United Kingdom",
      ),
    ).toEqual({
      state: "wont-sponsor",
      evidence:
        "This UK internship welcomes students with OPT, but we cannot provide visa sponsorship.",
      country: "United Kingdom",
    });
  });

  it("does not treat negated CPT or OPT eligibility as the US exception", () => {
    expect(
      extractVisaState(
        "This internship cannot provide visa sponsorship. CPT/OPT candidates are not eligible.",
        "United States",
      ),
    ).toEqual({
      state: "wont-sponsor",
      evidence: "This internship cannot provide visa sponsorship.",
      country: "United States",
    });
  });

  it("does not treat a non-internship OPT mention as the US exception", () => {
    expect(
      extractVisaState(
        "This research role cannot provide visa sponsorship. Candidates with OPT may apply.",
        "United States",
      ),
    ).toEqual({
      state: "wont-sponsor",
      evidence: "This research role cannot provide visa sponsorship.",
      country: "United States",
    });
  });

  it("uses the EU Blue Card set for an EU member country", () => {
    expect(
      extractVisaState(
        "The institute will support your EU Blue Card application.",
        "Germany",
      ),
    ).toEqual({
      state: "sponsors",
      evidence: "The institute will support your EU Blue Card application.",
      country: "Germany",
    });
  });

  it("detects Canada and Australia scoped phrases", () => {
    expect(
      extractVisaState("LMIA support is available for the successful candidate.", "Canada"),
    ).toMatchObject({ state: "sponsors", country: "Canada" });
    expect(
      extractVisaState(
        "Applicants must already have full Australian working rights.",
        "Australia",
      ),
    ).toMatchObject({ state: "wont-sponsor", country: "Australia" });
  });

  it("falls back to generic sponsorship language for other countries", () => {
    expect(
      extractVisaState(
        "Work permit sponsorship is available for this position.",
        "japan",
      ),
    ).toEqual({
      state: "sponsors",
      evidence: "Work permit sponsorship is available for this position.",
      country: "Japan",
    });
  });
});
