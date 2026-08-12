import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CONFERENCE_CITIES,
  extractBodyTextPlace,
  extractPlaceFromText,
  parseStructuredLocation,
  plausiblePlaceName,
  sanitizePlace,
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

  // B4-11. JobPosting.baseSalary/employmentType were declared on the
  // interface but never read anywhere in extractOpportunity() -- the four
  // cases below lock in the new reading, its plausibility gate, and its
  // presentation normalization.
  it("extracts JobPosting.baseSalary and employmentType, lower-cased to match every other source", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "JobPosting",
          "title": "Battery Researcher",
          "employmentType": "FULL_TIME",
          "baseSalary": {
            "@type": "MonetaryAmount",
            "currency": "USD",
            "value": {
              "@type": "QuantitativeValue",
              "minValue": 95000,
              "maxValue": 120000,
              "unitText": "YEAR"
            }
          }
        }
      </script>
    `;

    const [job] = extractJsonLdOpportunities(html);
    expect(job.salary).toEqual({
      min: 95000,
      max: 120000,
      currency: "USD",
      period: "year",
    });
    // Spec-conformant JSON-LD emits an uppercase enum; lower-cased so the
    // report's existing humanize() renders it the same way Adzuna's own
    // already-lowercase "full_time" does.
    expect(job.employmentType).toBe("full_time");
  });

  it("extracts a single-figure JobPosting.baseSalary with no min/max range", () => {
    // Some postings state one number, not a range -- minValue/maxValue are
    // absent and only QuantitativeValue.value is there. Both min and max
    // fall back to it.
    const html = `
      <script type="application/ld+json">
        {
          "@type": "JobPosting",
          "title": "Battery Researcher",
          "baseSalary": {
            "currency": "EUR",
            "value": { "value": 55000, "unitText": "YEAR" }
          }
        }
      </script>
    `;

    expect(extractJsonLdOpportunities(html)[0]?.salary).toEqual({
      min: 55000,
      max: 55000,
      currency: "EUR",
      period: "year",
    });
  });

  it("drops a baseSalary with no unit text rather than guessing a period", () => {
    const html = `
      <script type="application/ld+json">
        {
          "@type": "JobPosting",
          "title": "Battery Researcher",
          "baseSalary": { "currency": "EUR", "value": 55000 }
        }
      </script>
    `;

    expect(extractJsonLdOpportunities(html)[0]?.salary).toBeUndefined();
  });

  it("drops an implausible baseSalary rather than showing it as fact", () => {
    // normalizeSalary's own plausibility gate (salary.ts), reused here rather
    // than re-implemented. $3-$10/year is far below its MIN_ANNUALIZED floor.
    const html = `
      <script type="application/ld+json">
        {
          "@type": "JobPosting",
          "title": "Battery Researcher",
          "baseSalary": {
            "currency": "USD",
            "value": { "minValue": 3, "maxValue": 10, "unitText": "YEAR" }
          }
        }
      </script>
    `;

    expect(extractJsonLdOpportunities(html)[0]?.salary).toBeUndefined();
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

  // B7-01: preserve Event JSON-LD authority separately from the lower-tier
  // Open Graph title. A caller must not mistake an article headline for an
  // Event name merely because both supplied a generic `name` field before.
  it("keeps the typed Event name separate from the Open Graph title", () => {
    const html = `
      <script type="application/ld+json">
        { "@type": "Event", "name": "Real Conference Name" }
      </script>
      <meta property="og:title" content="Different Title From Og">
    `;
    expect(extractOpportunityPageDetails(html, "event")).toMatchObject({
      typedOpportunityName: "Real Conference Name",
      openGraphTitle: "Different Title From Og",
    });
  });

  it("retains an Open Graph title without treating it as a typed Event name", () => {
    const html = `
      <meta property="og:title" content="Fallback Title From Og">
    `;
    expect(extractOpportunityPageDetails(html, "event")).toMatchObject({
      openGraphTitle: "Fallback Title From Og",
    });
    expect(extractOpportunityPageDetails(html, "event").typedOpportunityName).toBeUndefined();
  });

  it("retains only one typed Event description and separates guarded OG evidence", () => {
    const typed = `<script type="application/ld+json">{ "@type": "Event", "name": "Battery Summit", "description": "Typed source summary." }</script>`;
    expect(extractOpportunityPageDetails(typed, "event").typedOpportunityDescription).toBe("Typed source summary.");
    const ambiguous = `${typed}<script type="application/ld+json">{ "@type": "Event", "name": "Other Event", "description": "Other summary." }</script>`;
    expect(extractOpportunityPageDetails(ambiguous, "event").typedOpportunityDescription).toBeUndefined();
    const og = '<meta property="og:title" content="Battery Summit | Example"><meta property="og:description" content="OG source summary.">';
    expect(extractOpportunityPageDetails(og, "event")).toMatchObject({ openGraphTitle: "Battery Summit | Example", openGraphDescription: "OG source summary." });
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

  // B4-02 (round 4): no test exercised two DIFFERENT gazetteer cities on one
  // page where only one is the true venue — findGazetteerMatch picked
  // whichever came first with no proximity check at all, which is R2's own
  // real shape (the true venue's city was mentioned, but a different
  // gazetteer city mentioned earlier or elsewhere on the page won instead).
  it("prefers a cued city over an earlier, uncued mention of a different city", () => {
    const html =
      "<html><body><p>The workshop is proudly sponsored by our Berlin office.</p>" +
      "<p>The event takes place in Chicago this year.</p></body></html>";
    const place = extractBodyTextPlace(html);
    expect(place?.city).toBe("Chicago");
  });

  it("returns absent, not a wrong city, when no gazetteer city has any cue", () => {
    const html =
      "<html><body><p>Our Berlin office and our Chicago office both contributed" +
      " to this year's programme.</p></body></html>";
    expect(extractBodyTextPlace(html)).toBeUndefined();
  });

  // B7-03: a complete current city/region/country clause is stronger than a
  // former listed host, even when the current city is outside the gazetteer.
  // exactly the way a current-venue mention does — "have previously been
  // held in Cologne" and "will be held in Lanzhou" both contain "held in" —
  // and nothing distinguished them. The true venue here is deliberately a
  // real, non-gazetteer city (Lanzhou is not in CONFERENCE_CITIES, mirroring
  // the actual gap A found).
  it("prefers a current non-gazetteer city clause over a former host", () => {
    const html =
      "<html><body><h1>International Titanium Conference</h1>" +
      "<p>The next edition will be held in Lanzhou, Gansu Province, China," +
      " from August 9.</p>" +
      "<p>Past editions of this conference have previously been held in" +
      " Cologne, Germany (2008).</p></body></html>";
    expect(extractBodyTextPlace(html)).toEqual({
      city: "Lanzhou",
      region: "Gansu Province",
      country: "China",
    });
  });

  // The parenthetical-edition-year signal must reject a past host even with
  // no explicit "previously"/"formerly" marker nearby — the shape a
  // comma-separated "held in X (year), Y (year)" list run takes on its own.
  it("rejects a city immediately paired with a parenthetical edition year, even without a 'previously' marker", () => {
    const html =
      "<html><body><p>Editions of this conference have been held in" +
      " Cologne, Germany (2008) and Chicago, IL (2012).</p></body></html>";
    expect(extractBodyTextPlace(html)).toBeUndefined();
  });

  // Must not over-trigger: an event naming its OWN edition number alongside
  // its current, cued venue is not a past-edition mention and must still
  // resolve normally.
  it("still resolves a current venue that happens to be mentioned with its own edition number", () => {
    const html =
      "<html><body><p>Join us for its 2026 edition, held in Austin, Texas.</p></body></html>";
    const place = extractBodyTextPlace(html);
    expect(place?.city).toBe("Austin");
  });

  it("accepts a generic current non-gazetteer city/country clause", () => {
    expect(extractBodyTextPlace("<body>The conference will be hosted in Aurora, Canada.</body>"))
      .toEqual({ city: "Aurora", region: undefined, country: "Canada" });
  });

  it("does not borrow a country from a later sentence for an unknown city", () => {
    expect(extractBodyTextPlace("<body>The conference will be held in Aurora. Canada supports this field.</body>"))
      .toBeUndefined();
  });

  it("does not promote an uncued geographic phrase or a facility-only phrase", () => {
    expect(extractBodyTextPlace("<body>Aurora, Canada is a research hub.</body>")).toBeUndefined();
    expect(extractBodyTextPlace("<body>The conference will take place in Aurora Convention Center, Canada.</body>"))
      .toBeUndefined();
  });

  it("suppresses both new and gazetteer fallbacks when current venue clauses disagree", () => {
    const html = "<body>The conference will be held in Aurora, Canada. It will take place in Chicago, United States.</body>";
    expect(extractBodyTextPlace(html)).toBeUndefined();
  });

  it("rejects a historical complete city/region/country clause", () => {
    const html = "<body>Past editions were held in Aurora, Ontario, Canada (2014).</body>";
    expect(extractBodyTextPlace(html)).toBeUndefined();
  });
});

describe("parseStructuredLocation", () => {
  it("splits City, ST, Country into components", () => {
    expect(parseStructuredLocation("Columbia, SC, United States")).toEqual({
      city: undefined,
      region: "SC",
      country: "United States",
    });
  });

  it("keeps a known city with its state and infers the country", () => {
    expect(parseStructuredLocation("Chicago, IL")).toEqual({
      city: "Chicago",
      region: "IL",
      country: "United States",
    });
  });

  it("does not turn a state name into a city", () => {
    const place = parseStructuredLocation("California, USA");
    expect(place?.city).toBeUndefined();
    expect(place?.country).toBe("United States");
  });

  it("normalizes country aliases", () => {
    expect(parseStructuredLocation("USA")?.country).toBe("United States");
    expect(parseStructuredLocation("Mumbai, India")).toEqual({
      city: "Mumbai",
      region: undefined,
      country: "India",
    });
  });

  it("returns undefined for junk rather than guessing", () => {
    expect(parseStructuredLocation("")).toBeUndefined();
    expect(parseStructuredLocation("Remote")).toBeUndefined();
  });
});

describe("place sanitization", () => {
  it("rejects a marketing sentence masquerading as a city", () => {
    expect(
      plausiblePlaceName(
        "The Global Leader in isostatic pressing technologies is your partner of choice.",
      ),
    ).toBeUndefined();
  });

  it("keeps real multi-word place names", () => {
    expect(plausiblePlaceName("Salt Lake City")).toBe("Salt Lake City");
    expect(plausiblePlaceName("New York")).toBe("New York");
  });
});

describe("facet label consistency", () => {
  it("splits a composite addressLocality instead of using it as a city", () => {
    expect(sanitizePlace({ city: "Columbia, SC, United States" })).toEqual({
      city: "Columbia",
      region: "SC",
      country: "United States",
    });
  });

  it("collapses country spellings to one label", () => {
    for (const raw of ["US", "USA", "United States of America", "United States"]) {
      expect(sanitizePlace({ city: "Aiken", country: raw })?.country).toBe(
        "United States",
      );
    }
  });
});
