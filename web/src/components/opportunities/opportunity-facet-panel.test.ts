import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  JobFacetPanel,
  toggleOpportunityFacet,
} from "./opportunity-facet-panel";
import { DEFAULT_JOB_FACET_SELECTION } from "@/lib/opportunities/facets";

describe("toggleOpportunityFacet", () => {
  it("adds selections without replacing another facet group", () => {
    expect(
      toggleOpportunityFacet(
        { location: ["Chicago"], format: ["hybrid"] },
        "month",
        "2026-09",
      ),
    ).toEqual({
      location: ["Chicago"],
      month: ["2026-09"],
      format: ["hybrid"],
    });
  });

  it("removes the active value case-insensitively", () => {
    expect(
      toggleOpportunityFacet(
        { location: ["Chicago", "Boston"] },
        "location",
        "chicago",
      ),
    ).toEqual({ location: ["Boston"] });
  });

  it("clears an empty group while preserving other selections", () => {
    expect(
      toggleOpportunityFacet(
        { location: ["Chicago"], format: ["online"] },
        "format",
        "online",
      ),
    ).toEqual({ location: ["Chicago"], format: undefined });
  });
});

describe("JobFacetPanel", () => {
  it("shows the internship pool count and keeps a zero-result location", () => {
    const html = renderToStaticMarkup(
      createElement(JobFacetPanel, {
        counts: {
          locations: { Chicago: 3 },
          roleKinds: {
            internship: 2,
            "phd-position": 1,
            postdoc: 0,
            staff: 4,
            faculty: 0,
          },
          visaStates: {
            sponsors: 3,
            "not-stated": 2,
            "wont-sponsor": 2,
          },
          when: { any: 7, "24h": 1, "7d": 4, "30d": 6 },
        },
        selection: {
          ...DEFAULT_JOB_FACET_SELECTION,
          locations: ["Tokyo"],
          locationMode: "only",
        },
        onChange: vi.fn(),
        onLocationAdded: vi.fn(),
        usesAuthorisationDefault: false,
      }),
    );

    expect(html).toContain("Internship 2");
    expect(html).toContain("Tokyo");
    expect(html).toContain(
      "nothing today, added to tomorrow&#x27;s search",
    );
    expect(html).toContain("Only these");
    expect(html).toContain("Won&#x27;t sponsor 2");
  });
});
