import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONFERENCE_CITIES,
  extractBodyTextPlace,
  extractPlaceFromText,
  extractJsonLdOpportunities,
  extractMetaOpportunityDetails,
  extractOpenGraphTags,
  extractOpportunityPageDetails,
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
            "title": "Battery Researcher",
            "jobLocation": {
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

describe("body-text place fallback", () => {
  it("finds Chicago in the measured BlueCurrent body-only case", () => {
    const fixture = readFileSync(
      new URL(
        "./__fixtures__/bluecurrent-solid-state-battery-summit.html",
        import.meta.url,
      ),
      "utf8",
    );

    expect(CONFERENCE_CITIES.length).toBeGreaterThanOrEqual(300);
    expect(extractBodyTextPlace(fixture)).toEqual({
      city: "Chicago",
      region: undefined,
      country: undefined,
    });
  });

  it("returns undefined when body text names no gazetteer city", () => {
    const html = `
      <html>
        <head>
          <meta property="og:title" content="Chicago is metadata, not body">
          <script>const venue = "Berlin";</script>
        </head>
        <body>
          <h1>Advanced Battery Materials Workshop</h1>
          <p>Review the program and electrochemistry research agenda.</p>
        </body>
      </html>
    `;

    expect(extractBodyTextPlace(html)).toBeUndefined();
    expect(
      extractBodyTextPlace("<body>A Parisian research program is accepting papers.</body>"),
    ).toBeUndefined();
  });

  it("adds an uppercase US state code and country without matching prose", () => {
    expect(
      extractBodyTextPlace(
        "<body>The meeting venue is Chicago, IL, United States.</body>",
      ),
    ).toEqual({
      city: "Chicago",
      region: "IL",
      country: "United States",
    });
  });

  it("uses structured and Open Graph places before the body fallback", () => {
    const jsonLdFirst = `
      <script type="application/ld+json">
        {
          "@type": "Event",
          "location": {
            "address": {
              "addressLocality": "Berlin",
              "addressCountry": "Germany"
            }
          }
        }
      </script>
      <meta property="og:title" content="Workshop | May 1, 2027 | Paris, France">
      <body>Join us in Chicago.</body>
    `;
    expect(extractOpportunityPageDetails(jsonLdFirst, "event").place).toEqual({
      city: "Berlin",
      region: undefined,
      country: "Germany",
    });

    const metaFirst = `
      <meta property="og:title" content="Workshop | May 1, 2027 | Paris, France">
      <body>Join us in Chicago.</body>
    `;
    expect(extractOpportunityPageDetails(metaFirst, "event").place).toEqual({
      city: "Paris",
      region: "France",
    });
  });
});

describe("country must belong to the city", () => {
  it("does not pair a city with an unrelated country mentioned elsewhere", () => {
    // The real failure: a titanium round table held in Cologne whose abstract
    // discusses production in China came out as "Cologne / China".
    const html =
      "<html><body><h1>2026 International Round Table on Titanium Production" +
      " in Molten Salts</h1><p>The meeting takes place in Cologne.</p>" +
      "<p>Titanium sponge production in China has grown rapidly.</p></body></html>";
    const place = extractBodyTextPlace(html);
    expect(place?.city).toBe("Cologne");
    expect(place?.country).toBeUndefined();
  });

  it("keeps a country that directly follows the city", () => {
    const html = "<html><body><p>Venue: Cologne, Germany</p></body></html>";
    const place = extractBodyTextPlace(html);
    expect(place?.city).toBe("Cologne");
    expect(place?.country).toBe("Germany");
  });

  it("still resolves US cities to United States via the state code", () => {
    const html = "<html><body><p>August 11-12, 2026 in Chicago, IL</p></body></html>";
    const place = extractBodyTextPlace(html);
    expect(place?.city).toBe("Chicago");
    expect(place?.region).toBe("IL");
    expect(place?.country).toBe("United States");
  });

  it("ignores a bare country with no venue cue", () => {
    expect(extractPlaceFromText("Titanium production in China is growing.")).toBeUndefined();
  });

  it("accepts a bare country when the page says it is the venue", () => {
    const place = extractPlaceFromText("The workshop will be held in Germany.");
    expect(place?.country).toBe("Germany");
  });
});
