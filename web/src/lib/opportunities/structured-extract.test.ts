import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { extractJsonLdOpportunities } from "./structured-extract";

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
