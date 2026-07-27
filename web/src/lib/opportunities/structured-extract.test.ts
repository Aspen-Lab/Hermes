import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractJsonLdOpportunities,
  extractMetaOpportunityDetails,
  extractOpenGraphTags,
} from "./structured-extract";

describe("extractJsonLdOpportunities", () => {
  it("extracts the measured DLR event location and date", () => {
    const fixture = readFileSync(
      new URL("./__fixtures__/dlr-emea2026-workshop.html", import.meta.url),
      "utf8",
    );

    expect(extractJsonLdOpportunities(fixture)).toEqual([
      {
        kind: "event",
        name: "EMEA 2026 Workshop",
        startDate: "2026-06-22T18:30:00+02:00",
        endDate: "2026-06-23T17:00:00+02:00",
        place: {
          city: "Oldenburg",
          country: "Germany",
        },
        eventAttendanceMode:
          "https://schema.org/OfflineEventAttendanceMode",
      },
    ]);
  });

  it("walks root arrays and @graph while tolerating a malformed block", () => {
    const html = `
      <script type="application/ld+json">{ definitely not JSON }</script>
      <script TYPE='application/ld+json; charset=utf-8'>
        [
          {
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": ["Thing", "EducationEvent"],
                "name": "Battery School",
                "startDate": "2026-09-01",
                "location": [{
                  "@type": "Place",
                  "address": {
                    "@type": "PostalAddress",
                    "addressLocality": "Chicago",
                    "addressRegion": "IL",
                    "addressCountry": { "name": "United States" }
                  }
                }]
              }
            ]
          }
        ]
      </script>
    `;

    expect(extractJsonLdOpportunities(html)).toEqual([
      {
        kind: "event",
        name: "Battery School",
        startDate: "2026-09-01",
        endDate: undefined,
        place: {
          city: "Chicago",
          region: "IL",
          country: "United States",
        },
        eventAttendanceMode: undefined,
      },
    ]);
  });

  it("extracts JobPosting nodes and ignores unrelated schema objects", () => {
    const html = `
      <script type=application/ld+json>
        [
          { "@type": "Organization", "name": "Example Lab" },
          {
            "@type": "https://schema.org/JobPosting",
            "name": "Battery Researcher",
            "location": {
              "address": {
                "addressLocality": "Berlin",
                "addressCountry": "Germany"
              }
            }
          }
        ]
      </script>
    `;

    expect(extractJsonLdOpportunities(html)).toEqual([
      {
        kind: "job",
        name: "Battery Researcher",
        startDate: undefined,
        endDate: undefined,
        place: {
          city: "Berlin",
          country: "Germany",
        },
        eventAttendanceMode: undefined,
      },
    ]);
  });
});

describe("Open Graph opportunity metadata", () => {
  it("extracts the measured Cambridge date, place, and hybrid format", () => {
    const fixture = readFileSync(
      new URL(
        "./__fixtures__/cambridge-solid-state-battery-summit.html",
        import.meta.url,
      ),
      "utf8",
    );

    expect(extractOpenGraphTags(fixture)).toEqual({
      title:
        "Solid-State Battery Summit | August 11-12, 2026 | Chicago, IL + Virtual",
      description:
        "Join the leading solid-state battery event in Chicago & online.",
      siteName: "Cambridge EnerTech",
    });
    expect(extractMetaOpportunityDetails(fixture)).toEqual({
      start: "2026-08-11",
      end: "2026-08-12",
      city: "Chicago",
      region: "IL",
      isOnline: true,
    });
  });

  it("keeps a city when Hybrid is the format marker", () => {
    const html = `
      <meta content="Battery Workshop | September 3, 2026 | Berlin, Germany — Hybrid"
            property="og:title">
    `;

    expect(extractMetaOpportunityDetails(html)).toEqual({
      start: "2026-09-03",
      end: undefined,
      city: "Berlin",
      region: "Germany",
      isOnline: true,
    });
  });
});
