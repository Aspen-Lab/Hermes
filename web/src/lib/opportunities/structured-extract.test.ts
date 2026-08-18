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
  declaresArticleKind,
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

  it("reads the Hybrid format marker as online", () => {
    // A29-02 (round 29 C, item 2) — **RESTATED, NOT DELETED, AND RENAMED TO
    // WHAT IT NOW PROVES.** This is the second of exactly two named costs.
    //
    // The Hybrid half of this test is untouched and still green: the marker is
    // stripped from the segment and `isOnline` is true. What moved is the city.
    // `Berlin, Germany` was accepted by the old comma reader on its comma
    // alone; the gazetteer-backed reader that replaces it finds **no locational
    // cue and no state code** here, so it declines. Same clause that stops
    // `Quintus Technologies, The Global Leader in isostatic pressing` from
    // becoming a city — the two shapes are identical to a comma.
    //
    // **THE COST IS NAMED, NOT ABSORBED** (round 29 B's own falsifier for this
    // item). If a later round finds an honest cue for the `City, Country` shape
    // in a pipe segment, RESTATE this with that item named — do not delete it.
    const html = `
      <meta content="Battery Workshop | September 3, 2026 | Berlin, Germany — Hybrid"
            property="og:title">
    `;

    expect(extractMetaOpportunityDetails(html)).toEqual({
      start: "2026-09-03",
      end: undefined,
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
    // A23-03 / Ruling 62a RESTATEMENT. This real page still yields Chicago —
    // it is one of the 33 of 41 rows B measured as UNCHANGED — but the whole-
    // page scan now needs the item's own name, which is what `enrich.ts`
    // supplies on every live row. B's ablation names this page under `P_name`.
    expect(
      extractBodyTextPlace(fixture, { eventName: "Solid-State Battery Summit" }),
    ).toEqual({
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

  // A23-03 / Ruling 62a RESTATEMENT (not a deletion). The state-code/country
  // pairing this test was written for is unchanged; what changed is that the
  // whole-page scan now also asks WHOSE city it is, and a one-sentence fixture
  // carries no witness that the event itself is there. The pipeline always
  // supplies the item's own name (`enrich.ts`), so the test supplies it too —
  // and the second assertion pins the new contract on the same fixture.
  it("adds an uppercase US state code and country when the event itself is the witness", () => {
    expect(
      extractBodyTextPlace(
        "<body>The Molten Salt Chemistry meeting venue is Chicago, IL, United States.</body>",
        { eventName: "Molten Salt Chemistry Meeting" },
      ),
    ).toEqual({
      city: "Chicago",
      region: "IL",
      country: "United States",
    });
  });

  it("withholds the same address when nothing ties the city to this event", () => {
    expect(
      extractBodyTextPlace(
        "<body>The meeting venue is Chicago, IL, United States.</body>",
      ),
    ).toBeUndefined();
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

    // A29-02 (round 29 C, item 2) — **RESTATED, NOT DELETED. THIS IS A NAMED
    // COST, AND IT IS ONE OF EXACTLY TWO IN THE SHIPPED CORPUS.**
    //
    // Before this item the meta channel used a comma reader with no gazetteer
    // and no ownership test, so `Paris, France` was accepted on its comma
    // alone — and so was `Quintus Technologies, The Global Leader in isostatic
    // pressing`, the company's own name, on the identical evidence. The two
    // are indistinguishable to a comma.
    //
    // The meta channel now goes through the same gazetteer-backed,
    // 62a-guarded reader as the body channel. `Paris` carries **no locational
    // cue and no state code** in this fixture, so no mention qualifies and the
    // meta channel is honestly SILENT. The body then offers a RIVAL city
    // (`Join us in Chicago`) with no ownership clause, so it is refused too,
    // and the place is absent.
    //
    // **What the assertion now states:** the PRIORITY this test was written to
    // prove is unchanged — JSON-LD still outranks meta, meta still outranks
    // body, nothing is reordered. What changed is the STANDARD the meta layer
    // must meet. Measured identical under `scope: "structured-field"`, so this
    // is the gazetteer/cue requirement, not Ruling 62a's ownership guard.
    const metaFirst = `
      <meta property="og:title" content="Workshop | May 1, 2027 | Paris, France">
      <body>Join us in Chicago.</body>
    `;
    expect(extractOpportunityPageDetails(metaFirst, "event").place).toBeUndefined();

    // And the fix's own point, on the same shape: a meta place the gazetteer
    // CAN see, with a state code to qualify it, still outranks the body.
    const metaFirstQualified = `
      <meta property="og:title" content="Workshop | May 1, 2027 | Austin, TX">
      <body>Join us in Chicago.</body>
    `;
    expect(extractOpportunityPageDetails(metaFirstQualified, "event").place).toEqual({
      city: "Austin",
      region: "TX",
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

  it("fails closed for missing Event descriptions and unusable metadata", () => {
    const missing = '<script type="application/ld+json">{ "@type": "Event", "name": "Battery Summit" }</script>';
    expect(extractOpportunityPageDetails(missing, "event").typedOpportunityDescription).toBeUndefined();
    const unusable = '<meta property="og:title" content="Home | Example"><meta property="og:description" content="OG text.">';
    expect(extractOpportunityPageDetails(unusable, "event")).toMatchObject({ openGraphTitle: "Home | Example", openGraphDescription: "OG text." });
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

  // A23-03 / Ruling 62a RESTATEMENT. Same fixture, same mechanism (the country
  // must sit directly after the city); the event's own name now has to be
  // present for the whole-page scan to accept the mention at all. `Venue:` as a
  // label is exactly the `P_label` clause B measured as VACUOUS and the manager
  // declined to ship — an unearned clause does not ship, so this shape needs a
  // real witness.
  it("keeps a country that directly follows the city", () => {
    const html =
      "<html><body><p>Molten Salt Forum — Venue: Cologne, Germany</p></body></html>";
    const place = extractBodyTextPlace(html, { eventName: "Molten Salt Forum" });
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
  // A23-03 / Ruling 62a RESTATEMENT. The point of this test — a CURRENT year
  // beside the venue must not read as a past edition — is now also the point of
  // `N_pastyear`, so it is pinned against a fixed clock instead of the wall
  // clock, and the event's own name supplies the witness the guard requires.
  it("still resolves a current venue that happens to be mentioned with its own edition number", () => {
    const html =
      "<html><body><p>Join us for the Titanium Round Table's 2026 edition, held in Austin, Texas.</p></body></html>";
    const place = extractBodyTextPlace(html, {
      eventName: "Titanium Round Table",
      now: new Date("2026-08-15T00:00:00Z"),
    });
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

// A23-03 / Ruling 62a — THE PLACE OWNERSHIP GUARD.
//
// Four live pool rows rendered a city lifted out of a sentence about a
// DIFFERENT entity. The guard asks whether the EVENT ITSELF is present beside
// the city (three positives) and whether the sentence says the city belongs to
// someone else (three negatives, evaluated after the positives, vetoing).
//
// Every clock here is fixed. `P_date` and `N_pastyear` both read the current
// year, and a test whose verdict flips on 1 January is not a test.
describe("A23-03 — the place ownership guard", () => {
  const NOW = new Date("2026-08-15T00:00:00Z");
  const page = (body: string) => `<html><body><p>${body}</p></body></html>`;
  const scan = (body: string, eventName?: string) =>
    extractBodyTextPlace(page(body), { eventName, now: NOW });

  // B's adversarial table, part 4 of item 1 — the values that MUST KEEP.
  it("keeps a venue-anchored city (P_venue)", () => {
    expect(scan("The molten salt congress will be held in Lyon, France.")?.city)
      .toBe("Lyon");
    expect(scan("Join us at the Palais des Congres in Lyon for three days.")?.city)
      .toBe("Lyon");
  });

  it("keeps a city carrying the event's own future dates (P_date)", () => {
    expect(scan("OCTOBER 12-15, 2027 Huntington Place Detroit, MI")?.city)
      .toBe("Detroit");
  });

  it("keeps a city whose clause is cut only by an ABBREVIATION period", () => {
    // The measured false silence: `[^.]`-style windows cannot cross "Oct.", and
    // a first build of this guard silenced npaonline.org's correct Denver.
    // Treat that dot as a sentence end and the clause loses the FUTURE year in
    // front of it, keeping only the past one behind — so N_pastyear fires on a
    // current venue.
    expect(
      scan(
        "The 2027 NPA Annual Conference will be held Oct. 11-14 in Denver, CO, as it was in 2019.",
      )?.city,
    ).toBe("Denver");
  });

  it("keeps a city witnessed only by the event's own name (P_name)", () => {
    expect(scan("SSI24 will convene in Kyoto for five days of talks.", "SSI24 Solid State Ionics")
      ?.city).toBe("Kyoto");
  });

  it("keeps the FIRST admissible mention when a page carries two rival venue statements", () => {
    expect(
      scan(
        "The congress will be held in Lyon. A partner congress will be held in Tokyo.",
      )?.city,
    ).toBe("Lyon");
  });

  it("rejects ONE mention, not the whole answer — the guard is inside the acceptance loop", () => {
    // At the caller the guard cannot see WHICH mention won, so it could only
    // discard everything. Here the sponsor's seat is rejected and the event's
    // real venue, later on the same page, still wins.
    expect(
      scan(
        "Our sponsor Acme is based in Boston. The Molten Salt Forum is hosted in Lyon.",
        "Molten Salt Forum",
      )?.city,
    ).toBe("Lyon");
  });

  // The four live contaminations, each now silent.
  it("N_seat — drops an exhibitor's head office (storageusa → Durham)", () => {
    expect(scan("Based in Durham, N.C., FlexGen Congress is a leader.")).toBeUndefined();
    expect(scan("Sponsor profile: Acme Congress is headquartered in Boston.")).toBeUndefined();
  });

  it("P_venue excludes affiliation words — drops a speaker's postal address (nanoge → Chicago)", () => {
    expect(
      scan("Prof. Ada Lee, Illinois Institute of Technology, Chicago, IL, 60616, USA."),
    ).toBeUndefined();
  });

  it("N_pastyear — drops a finished meeting named in a biography (flogen → Geneva)", () => {
    // The event's own name IS in the window, so a positive fires and only
    // N_pastyear can silence this. Without the name it would be silent anyway,
    // for want of any positive — which would make the test decoration.
    expect(
      scan(
        "Plenary Lecture at the Molten Salt Forum Meetings in Geneva in February 2022.",
        "Molten Salt Forum",
      ),
    ).toBeUndefined();
  });

  it("N_otherevent — drops the organiser's OTHER conference (sdle → Oslo)", () => {
    // The real shape, kept intact: "in Israel" is what satisfies the shipped
    // proximity cue 40 characters later, and the item's own name ("Battery")
    // is what satisfies P_name — so this mention IS accepted today and IS
    // admitted by a positive. Only N_otherevent can silence it.
    expect(
      scan(
        "Local Battery Training in Israel Our Conferences 7th Oslo Battery Days Conference, Oslo, Norway",
        "Turkey Battery Technologies Summit 2026",
      ),
    ).toBeUndefined();
  });

  it("drops a careers-page list of office cities with no witness at all", () => {
    expect(scan("Austin Berlin Boston, MA Brussels Budapest")).toBeUndefined();
  });

  // THE ACCEPTED, NAMED COST (Ruling 62a): a correct venue is lost because the
  // row is nine years stale. It should not be in a live pool at all.
  it("accepts the abilities.com cost — a March 2017 venue goes silent", () => {
    // This is the honest cost, stated at full strength: the row's OWN name and
    // its OWN true venue are both present, and it is silenced anyway because
    // every year in the clause has passed. A nine-year-old row should not be
    // in a live pool.
    expect(
      scan(
        "The Abilities Expo runs ONE DAY ONLY on Friday, March 24, 2017 at the Los Angeles Convention Center.",
        "Abilities Expo",
      ),
    ).toBeUndefined();
  });

  // THE BOUNDARY CONDITIONS, each a uniquely-red case for one clause.
  it("N_otherevent is START-anchored — unanchored it broke 10 of 41 rows", () => {
    // The event word sits later in the window, not opening a name run off the
    // city. Unanchored this went silent; anchored it must KEEP.
    expect(
      scan("OCTOBER 12-15, 2027 Huntington Place Detroit, MI — The Battery Show")
        ?.city,
    ).toBe("Detroit");
  });

  it("N_otherevent does not fire on lower-case prose after the city", () => {
    expect(scan("The congress will be held in Lyon for three days of talks.")?.city)
      .toBe("Lyon");
  });

  it("P_name ignores generic event words — without the stop-list it admits everything", () => {
    // "annual" and "conference" are in every event's name and witness nothing.
    // Drop the stop-list and this clause matches on every page, becoming a
    // no-op that HIDES the other five clauses' failures.
    expect(
      scan(
        "Our annual conference programme committee is located in Boston.",
        "Annual Battery Conference",
      ),
    ).toBeUndefined();
  });

  it("P_name requires tokens of four characters or more", () => {
    // A three-letter acronym is too weak a witness to carry the whole gate.
    expect(
      scan("Our SSI sponsor liaison is located in Boston.", "SSI Molten Salt"),
    ).toBeUndefined();
  });

  it("N_pastyear is scoped to ONE clause, so a stale year nearby cannot taint a current venue", () => {
    // A copyright year or a past-edition link sitting near a correct current
    // venue trips the window-wide form. Phrased to avoid "will be held in X,
    // Country", which the separate current-venue clause answers before this
    // guard is ever consulted.
    expect(
      scan(
        "Copyright 2019 Molten Salt Forum. The Molten Salt Forum is hosted in Lyon.",
        "Molten Salt Forum",
      )?.city,
    ).toBe("Lyon");
  });

  it("negatives VETO — a positive may not rescue a mention a negative rejected", () => {
    // `pos || !neg` instead of `pos && !neg` brings six rows back wrong and
    // re-opens three of the four contaminations. Both fixtures carry a strong
    // POSITIVE and must still be silent.
    expect(
      scan("The Molten Salt Forum sponsor is based in Durham, N.C.", "Molten Salt Forum"),
    ).toBeUndefined();
    expect(
      scan("Molten Salt Forum, October 12-15, 2027 — Our Conferences 7th Oslo Battery Days", "Molten Salt Forum"),
    ).toBeUndefined();
  });

  it("every candidate rejected leaves the place ABSENT, never a country and never a host", () => {
    // Ruling 26's `|| host` lesson. Silence is the state the build already
    // renders (solarpaces.org proves it is reachable today).
    expect(scan("Based in Durham, N.C., FlexGen Congress is a leader.")).toBeUndefined();
  });

  // THE EXEMPTION — the largest blast-radius fact in the item.
  it("does not touch a provider's short structured place field (ccfddl)", () => {
    // `ccfddl.ts:147` calls this on "Chicago, IL + Virtual". No positive clause
    // can fire on a string that short, so guarding it would silence a field
    // that was never ambiguous.
    expect(extractPlaceFromText("Chicago, IL + Virtual")).toEqual({
      city: "Chicago",
      region: "IL",
      country: "United States",
    });
  });

  it("gates the bare-country arm by the SAME test when a page IS scanned", () => {
    // Ruling 26: a city the guard just rejected must not publish its country
    // through the back door. Exempt scope keeps the old contract; page scope
    // requires the same witness.
    expect(extractPlaceFromText("The workshop will be held in Germany.")?.country)
      .toBe("Germany");
    expect(
      extractPlaceFromText("The workshop will be held in Germany.", {
        scope: "page",
        now: NOW,
      }),
    ).toBeUndefined();
    expect(
      extractPlaceFromText(
        "The Molten Salt Forum will be held in Germany.",
        { scope: "page", eventName: "Molten Salt Forum", now: NOW },
      )?.country,
    ).toBe("Germany");
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

// ───────────────────────────────────────────────────────────────────────
// A27-04 (round 27, item 1). THE FUSED CITY.
//
// `thebatteryshowsouth.com`'s root page serves, in its only JSON-LD block,
// `addressLocality: "Atlanta GA"` with NO `addressRegion` — the site fuses the
// two itself; nothing in Peer joins them. `sanitizePlace` found no comma to
// split on, `plausiblePlaceName` accepted a 2-word 10-char string, and the
// fused value reached a rendered card, a WHERE tile and a facet button.
//
// The live benchmark caught it, but that assertion is guarded by "assert on
// rows PRESENT; never demand presence" — a pull that does not offer the host
// skips it, and the suite went green with the defect still live at source.
// THAT IS WHY THIS BLOCK EXISTS: a live lock that can skip is not a lock. The
// cases below are deterministic and pin the shape from both sides.
// ───────────────────────────────────────────────────────────────────────
describe("A27-04: a space-fused trailing US state code", () => {
  it("splits the fused city off the state and keeps the country untouched", () => {
    expect(
      sanitizePlace({ city: "Atlanta GA", country: "United States" }),
    ).toEqual({ city: "Atlanta", region: "GA", country: "United States" });
  });

  it("splits every shape in the must-split corpus", () => {
    const mustSplit: ReadonlyArray<[string, string, string]> = [
      ["Atlanta GA", "Atlanta", "GA"],
      ["Washington DC", "Washington", "DC"],
      ["New York NY", "New York", "NY"],
      ["Kansas City MO", "Kansas City", "MO"],
      ["Salt Lake City UT", "Salt Lake City", "UT"],
      // An all-caps source still splits: only the CODE's case is checked.
      ["SAN DIEGO CA", "SAN DIEGO", "CA"],
      ["Perth WA", "Perth", "WA"],
      // Whitespace is normalised before the match, so a double space splits
      // and the head comes back single-spaced.
      ["Atlanta  GA", "Atlanta", "GA"],
    ];
    for (const [input, city, region] of mustSplit) {
      expect(sanitizePlace({ city: input })).toEqual({
        city,
        region,
        country: undefined,
      });
    }
  });

  it("leaves every shape in the must-not-split corpus exactly as it is", () => {
    const mustNotSplit = [
      "Atlanta",
      // Clause 1 — the code's case is the guard. Make the pattern
      // case-insensitive and these two split.
      "Atlanta Ga",
      "atlanta ga",
      // No head to keep: the pattern needs whitespace before the code.
      "GA",
      "Cologne",
      "São Paulo",
      "Rio de Janeiro",
      "Ho Chi Minh City",
      "Frankfurt am Main",
      // Clause 2 — a spelt-out region is not a code, so nothing splits.
      "Atlanta Georgia",
      "Stratford upon Avon",
      "Newcastle upon Tyne",
      "Aix en Provence",
      "La Paz",
      "Los Angeles",
      "Santa Fe",
      "Port au Prince",
      "Ciudad de Mexico",
      "Palo Alto",
    ];
    for (const input of mustNotSplit) {
      expect(sanitizePlace({ city: input })?.city).toBe(input);
    }
  });

  it("only splits on the closed 51-code list, never a bare two-letter tail", () => {
    // Clause 2. "KA" is Karnataka — a real subdivision code, and not one of
    // the 51 this list knows. Half-parsing it would invent a US-shaped region.
    expect(sanitizePlace({ city: "Bengaluru KA" })?.city).toBe("Bengaluru KA");
    expect(sanitizePlace({ city: "Bengaluru KA" })?.region).toBeUndefined();
  });

  it("refuses a split that would leave a head which is not a name", () => {
    // Clause 3. Both of these read as a place today; a split would turn one
    // into an empty city and the other into a numeric one.
    expect(sanitizePlace({ city: "X GA" })?.city).toBe("X GA");
    expect(sanitizePlace({ city: "2026 GA" })?.city).toBe("2026 GA");
  });

  it("never overwrites a region the source spelt out itself", () => {
    // Clause 4 — `region ??=`, never `=`.
    expect(
      sanitizePlace({ city: "Atlanta GA", region: "Georgia" }),
    ).toEqual({ city: "Atlanta", region: "Georgia", country: undefined });
  });

  it("never infers a country from the state code", () => {
    // The clause that bites: "WA" is Western Australia as readily as
    // Washington. `parseStructuredLocation` may add "United States" when it
    // pops a code out of a COMMA-delimited field; on a space-fused string
    // that would be a guess.
    expect(sanitizePlace({ city: "Perth WA", country: "Australia" })).toEqual({
      city: "Perth",
      region: "WA",
      country: "Australia",
    });
    expect(sanitizePlace({ city: "Perth WA" })?.country).toBeUndefined();
  });

  it("damages none of Peer's own 454 gazetteer cities, in either casing", () => {
    // The strongest boundary available: every city name Peer itself believes
    // in, run through the sanitiser as written AND upper-cased.
    expect(CONFERENCE_CITIES.length).toBeGreaterThan(400);
    for (const city of CONFERENCE_CITIES) {
      expect(sanitizePlace({ city })?.city).toBe(city);
      const shouted = city.toUpperCase();
      expect(sanitizePlace({ city: shouted })?.city).toBe(shouted);
    }
  });

  it("leaves the comma branch's own behaviour alone", () => {
    // The space branch is an `else` of the comma branch, so a comma-form
    // address cannot reach it. Guards the shipped case above from this item.
    expect(sanitizePlace({ city: "Columbia, SC, United States" })).toEqual({
      city: "Columbia",
      region: "SC",
      country: "United States",
    });
  });
});

// ───────────────────────────────────────────────────────────────────────
// B20-02 (A: event A20-02). The self-distrusting address guard.
//
// A real page declared its venue TWICE: `Place.name` = "NH Villa Carpegna"
// and `address.addressLocality` = "NH Villa Carpegna" again, with the country
// sitting in `addressRegion`. `extractPlace` read only `address`, so the one
// field that PROVED the locality slot was holding a venue name was discarded,
// and a hotel became the city on the Location facet button and in the
// `location` string derived from it.
//
// The guard is a comparison of ONE record against ITSELF. By construction it
// cannot fire on a well-formed record, because a well-formed record's venue
// name and its locality are different strings — asserted below, not assumed.
//
// NEGATIVE PROOF, MEASURED BY MUTATION (not claimed). Removing the guard
// entirely turns 3 of the tests below red. Replacing `canonicalize(a) ===
// canonicalize(b)` with a raw `a === b` turns exactly 1 red ("compares
// canonically"). Blanking only the city instead of returning `undefined`
// turns 3 red. Dropping BOTH presence conjuncts turns exactly 1 red ("names
// NEITHER").
//
// DOCUMENTED AS STRUCTURALLY UNTESTABLE (Ruling 53b): dropping EITHER
// presence conjunct ON ITS OWN turns ZERO tests red, and no test can be
// written that would. With one conjunct still in place the other side's
// missing value can only ever be compared as "", which never equals a
// non-empty string, so each conjunct is individually redundant — and both are
// nonetheless required, because `canonicalize` takes a `string` and the type
// checker rejects either one alone. A later round must not "fix" this by
// deleting a conjunct, and must not add a test claiming to cover one.
//
// The four "stays silent" cases and the fixture LOCK below are ADMITTED
// CONTROLS: they pass before and after, and they are must-keeps, not coverage.
// ───────────────────────────────────────────────────────────────────────
describe("B20-02 — a Place whose locality repeats its own venue name", () => {
  // The record shape, field-for-field. Not scraped: reconstructed from the
  // values recorded in the round-20 investigation.
  function venuePage(
    place: Record<string, unknown>,
    body = "<p>Abstract submissions close in April.</p>",
  ): string {
    return `<html><head><script type="application/ld+json">${JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Event",
      name: "Chemistry World Conference",
      startDate: "2027-06-21",
      location: place,
    })}</script></head><body>${body}</body></html>`;
  }

  const SELF_REPEATING = {
    "@type": "Place",
    name: "NH Villa Carpegna",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Via Pio IV, 6, 00165 Roma RM, Italy",
      addressLocality: "NH Villa Carpegna",
      addressRegion: "Italy",
      postalCode: "00165",
      addressCountry: "Italy",
    },
  };

  // Body text naming a gazetteer city with a proximity cue — the lower layer
  // that was already computing the right answer and never getting to run.
  const BODY_WITH_CITY = "<p>The conference will be held in Rome, Italy.</p>";

  it("fails the JSON-LD branch closed so the body-text layer answers", () => {
    // THE uniquely-red test for the guard. Reverting it puts the hotel back.
    expect(
      extractOpportunityPageDetails(venuePage(SELF_REPEATING, BODY_WITH_CITY), "event")
        .place,
    ).toEqual({ city: "Rome", region: undefined, country: "Italy" });
  });

  it("drops the whole address record, not just the city", () => {
    // Load-bearing, and measured: blanking only the city leaves
    // `{region:"Italy", country:"Italy"}`, which is still truthy, so the `??`
    // chain would stop at the JSON-LD branch and the body-text city would
    // never be reached. This asserts the region and country go too.
    const place = extractOpportunityPageDetails(
      venuePage(SELF_REPEATING),
      "event",
    ).place;
    expect(place).toBeUndefined();
  });

  it("compares canonically, so case and spacing cannot dodge the guard", () => {
    expect(
      extractOpportunityPageDetails(
        venuePage({
          "@type": "Place",
          name: "NH  Villa Carpegna",
          address: {
            "@type": "PostalAddress",
            addressLocality: "nh villa carpegna",
            addressCountry: "Italy",
          },
        }),
        "event",
      ).place,
    ).toBeUndefined();
  });

  it("stays silent when the record names a venue but no locality", () => {
    expect(
      extractOpportunityPageDetails(
        venuePage({
          "@type": "Place",
          name: "NH Villa Carpegna",
          address: { "@type": "PostalAddress", addressCountry: "Italy" },
        }),
        "event",
      ).place,
    ).toEqual({ city: undefined, region: undefined, country: "Italy" });
  });

  it("stays silent when the record names a locality but no venue", () => {
    expect(
      extractOpportunityPageDetails(
        venuePage({
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Oldenburg",
            addressCountry: "Germany",
          },
        }),
        "event",
      ).place,
    ).toEqual({ city: "Oldenburg", region: undefined, country: "Germany" });
  });

  it("stays silent when the record names NEITHER — a country-only address survives", () => {
    // The `locality && venueName &&` conjuncts are load-bearing, and this is
    // the case that proves it: with both fields absent, a comparison that did
    // not guard on presence would compare "" against "", call them equal, and
    // throw away a perfectly good country. Measured — without this test the
    // conjuncts had NO red test at all.
    expect(
      extractOpportunityPageDetails(
        venuePage({
          "@type": "Place",
          address: { "@type": "PostalAddress", addressCountry: "Germany" },
        }),
        "event",
      ).place,
    ).toEqual({ city: undefined, region: undefined, country: "Germany" });
  });

  it("stays silent when a well-formed record names both and they differ", () => {
    expect(
      extractOpportunityPageDetails(
        venuePage({
          "@type": "Place",
          name: "Palazzo dei Congressi",
          address: {
            "@type": "PostalAddress",
            addressLocality: "Rome",
            addressCountry: "Italy",
          },
        }),
        "event",
      ).place,
    ).toEqual({ city: "Rome", region: undefined, country: "Italy" });
  });

  it("LOCK, not coverage: the shipped German-workshop fixture is unchanged", () => {
    // ADMITTED CONTROL. This fixture passes BEFORE and AFTER the guard, so it
    // is NOT negative proof of the change — it is the must-keep witness that
    // the guard cuts the right way on a REAL page whose venue name
    // ("DLR Institute of Networked Energy Systems") and locality
    // ("Oldenburg") genuinely differ. A later round must not present it as
    // coverage of the guard.
    const fixture = readFileSync(
      new URL("./__fixtures__/dlr-emea2026-workshop.html", import.meta.url),
      "utf8",
    );
    expect(extractOpportunityPageDetails(fixture, "event").place).toEqual({
      city: "Oldenburg",
      region: undefined,
      country: "Germany",
    });
  });
});

// A23-04 / Ruling 62c — DOES THE PAGE DECLARE ITSELF AN ARTICLE?
//
// Half of a conjunction. Alone this signal drops `careerservices.upenn.edu`, a
// real Oak Ridge vacancy Ruling 34a names, because its careers board renders
// vacancies through an article template. The URL clause in `jobs/scoring.ts` is
// the other half; see `isNonJobArticle` for the pair.
describe("A23-04 — the page's own kind declaration", () => {
  const page = (head: string) => `<html><head>${head}</head><body><p>x</p></body></html>`;
  const jsonLd = (json: string) =>
    page(`<script type="application/ld+json">${json}</script>`);

  it("reads og:type, which was never extracted before this item", () => {
    expect(extractOpenGraphTags(page('<meta property="og:type" content="article">')).type)
      .toBe("article");
    expect(declaresArticleKind(page('<meta property="og:type" content="article">')))
      .toBe(true);
  });

  it("does not fire on the og:type every real posting page carries", () => {
    // Five captured job pages all declare `website`.
    expect(declaresArticleKind(page('<meta property="og:type" content="website">')))
      .toBe(false);
    expect(declaresArticleKind(page("<title>A job</title>"))).toBe(false);
  });

  it.each(["Article", "NewsArticle", "BlogPosting"])(
    "reads a top-level JSON-LD `%s`",
    (type) => {
      expect(declaresArticleKind(jsonLd(`{"@type":"${type}"}`))).toBe(true);
    },
  );

  it("reads the WordPress @graph shape, which is the measured one", () => {
    // The real page's types were ["Article","WebPage","WebSite"].
    expect(
      declaresArticleKind(
        jsonLd('{"@graph":[{"@type":"Article"},{"@type":"WebPage"},{"@type":"WebSite"}]}'),
      ),
    ).toBe(true);
  });

  it("does not read an Article NESTED inside another record", () => {
    // A page's own declaration about itself is top-level. A quoted or embedded
    // article is not the page.
    expect(
      declaresArticleKind(jsonLd('{"@type":"WebPage","mainEntity":{"@type":"Article"}}')),
    ).toBe(false);
  });

  it("a JobPosting record VETOES the whole check", () => {
    // Ruling 55c's floor: a page carrying a machine-readable vacancy is a
    // vacancy, whatever its template says. Both signals are present here.
    expect(
      declaresArticleKind(
        page(
          '<meta property="og:type" content="article">' +
            '<script type="application/ld+json">{"@type":"JobPosting","title":"Postdoc"}</script>',
        ),
      ),
    ).toBe(false);
    expect(
      declaresArticleKind(
        jsonLd('{"@graph":[{"@type":"Article"},{"@type":"JobPosting","title":"Postdoc"}]}'),
      ),
    ).toBe(false);
  });

  it("a malformed JSON-LD block decides nothing either way", () => {
    // On its own it proves nothing.
    expect(declaresArticleKind(jsonLd("{not json"))).toBe(false);
    // And it must not discard a VALID declaration that follows it — the same
    // tolerance `extractJsonLdOpportunities` already has.
    expect(
      declaresArticleKind(
        page(
          '<script type="application/ld+json">{not json</script>' +
            '<script type="application/ld+json">{"@type":"Article"}</script>',
        ),
      ),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// ROUND 29 C, ITEM 2 (A29-02) — the meta channel is held to the same standard
// as the body channel. Round 29 B's fix (b).
// ---------------------------------------------------------------------------

describe("A29-02 — the company name in the city slot", () => {
  // The measured shape of
  // `quintustechnologies.com/events/solid-state-batteries-summit-2026/`:
  // an og:description that OPENS with the company name and a comma, which the
  // old comma reader took as `city, region`. Round 29 B proved the false city
  // comes from the description BY ITSELF — dropping `og:siteName` from the
  // joined text changes nothing.
  const QUINTUS = `
    <meta property="og:title" content="Solid-State Battery Summit 2026 | Quintus Technologies">
    <meta property="og:site_name" content="Quintus Technologies">
    <meta property="og:description" content="Quintus Technologies, The Global Leader in isostatic pressing">
    <body>The Solid-State Battery Summit 2026 will be held in Chicago, IL on August 11-12, 2026.</body>
  `;

  it("REPRODUCES the defect on the old parser, so these cases are not vacuous", () => {
    // Guard against the fixture drifting away from the shape B measured. The
    // old comma reader required the WHOLE pipe segment to be `X, Y` with no
    // second comma, so a description carrying an extra clause never reproduced
    // the bug at all — C's first fixture had one and passed with the fix
    // REVERTED. This asserts the shape itself.
    const description = QUINTUS.match(/og:description" content="([^"]*)"/)?.[1];
    expect(description).toBe("Quintus Technologies, The Global Leader in isostatic pressing");
    expect((description ?? "").split(",")).toHaveLength(2);
  });

  it("no longer reads the company name as the city", () => {
    expect(extractMetaOpportunityDetails(QUINTUS).city).toBeUndefined();
  });

  it("falls through to the page's own city", () => {
    // The chain is NOT reordered. The meta channel simply goes honestly silent,
    // so the `??` chain reaches the whole-page scan that was always there.
    expect(extractOpportunityPageDetails(QUINTUS, "event").place).toEqual({
      city: "Chicago",
      region: "IL",
      country: "United States",
    });
  });
});
