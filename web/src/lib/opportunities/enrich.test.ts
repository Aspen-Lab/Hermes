import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RawEventItem } from "@/lib/events/types";
import type { RawJobItem } from "@/lib/jobs/types";
import {
  enrichEventCandidates,
  enrichJobCandidates,
  MAX_ENRICHMENT_CANDIDATES,
} from "./enrich";
import { scoreEventPoolCandidates } from "@/lib/events/pipeline";
import { scoreJobPoolCandidates } from "@/lib/jobs/pipeline";
// B19-02: the repaired title is asserted on the RENDERED card, not only on the
// enriched item, so the site's brand tail cannot slip back in via the mapper.
import { scoredJobToJob } from "@/lib/jobs/mapper";
import { scoreJobs } from "@/lib/jobs/scoring";

function event(index: number): RawEventItem {
  return {
    id: `eventweb:${index}`,
    source: "eventweb",
    // Round 35 C (Ruling 97) fixture repair: zero-padded so every one of
    // this generator's rows is `eventDedupKey`-distinct. Unpadded, indices
    // 0-9's single-character index token was dropped by the key's own
    // pre-existing `t.length > 1` filter, so all ten collapsed onto the
    // identical key `"battery event::"` (empty year, since `startDate` is
    // `""`) — a state production can never reach, because the FIRST dedup
    // pass (`dedupEvents`, `pipeline.ts:184`) would already have merged them
    // before `scoreEventPoolCandidates` ever ran; this fixture only survived
    // unpadded because its own tests call `scoreEventPoolCandidates`
    // directly, bypassing that outer pass. `id`/`url` are left unpadded —
    // neither feeds `eventDedupKey`, and every other test in this file that
    // depends on them does so by variable reference, not by a literal string.
    name: `Battery Event ${String(index).padStart(2, "0")}`,
    type: "conference",
    startDate: "",
    location: "See event page",
    isOnline: false,
    description: "Solid-state battery materials conference",
    url: `https://events.example.com/${index}`,
    tags: ["solid-state battery"],
  };
}

function job(index: number, isRemote = false): RawJobItem {
  return {
    id: `jobweb:${index}`,
    source: "jobweb",
    title: `Solid-State Battery Research Scientist ${index}`,
    company: "Example Lab",
    location: isRemote ? "Remote" : "",
    isRemote,
    description: "Research solid-state battery materials and electrochemistry",
    url: "https://jobs.example.com/role",
    postedAt: "2026-07-20",
    tags: ["solid-state battery"],
  };
}

function usablePage(content: string, selectedUrl = "https://jobs.example.com/role"): string {
  const scopedContent = content.replace(
    /("@type"\s*:\s*"JobPosting"\s*,?)/,
    `$1 "url": "${selectedUrl}",`,
  );
  const selectedPath = new URL(selectedUrl).pathname;
  return `<article><a href="${selectedPath}">Selected posting</a>${scopedContent}</article>` +
    `<main>${"Detailed opportunity information. ".repeat(800)}</main>`;
}

describe("event detail enrichment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("caps detail requests at 40 gate-surviving candidates", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const index = new URL(url).pathname.slice(1);
      return new Response(
        usablePage(`<script type="application/ld+json">
          {
            "@type": "Event",
            "name": "Enriched Event ${index}",
            "location": {
              "address": {
                "addressLocality": "Chicago",
                "addressRegion": "IL",
                "addressCountry": "United States"
              }
            }
          }
        </script>`),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const items = Array.from(
      { length: MAX_ENRICHMENT_CANDIDATES + 2 },
      (_, index) => event(index),
    );

    const enriched = await enrichEventCandidates(items);

    expect(fetchMock).toHaveBeenCalledTimes(MAX_ENRICHMENT_CANDIDATES);
    // B4-01: the fetched page's own JSON-LD name ("Enriched Event 0") now
    // wins over the pre-fetch ingestion guess ("Battery Event 00", round 35
    // C's zero-padded form) once it clears the title-shape guard — this
    // fixture's name is a plain string, so it passes and is preferred, same
    // as a real page's own title would be.
    expect(enriched[0]).toMatchObject({
      name: "Enriched Event 0",
      location: "Chicago, IL, United States",
      place: {
        city: "Chicago",
        region: "IL",
        country: "United States",
      },
    });
    expect(enriched[MAX_ENRICHMENT_CANDIDATES]).toBe(
      items[MAX_ENRICHMENT_CANDIDATES],
    );
  });

  it("keeps the item on fetch failure and preserves city plus online for hybrid", async () => {
    const original = event(1);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          usablePage(`<meta property="og:title"
             content="Solid-State Battery Summit | August 11-12, 2026 | Chicago, IL + Virtual">`),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const [failed, hybrid] = await enrichEventCandidates([
      original,
      event(2),
    ]);

    expect(failed).toBe(original);
    expect(hybrid).toMatchObject({
      startDate: "2026-08-11",
      endDate: "2026-08-12",
      location: "Chicago, IL",
      place: { city: "Chicago", region: "IL" },
      isOnline: true,
    });
  });

  it("enriches a source-backed current city/region/country clause", async () => {
    const item = event(91);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      "<body><p>The conference will be held in Aurora, Northern Territory, Australia.</p></body>",
      { status: 200 },
    )));

    const [enriched] = await enrichEventCandidates([item]);

    expect(enriched).toMatchObject({
      place: {
        city: "Aurora",
        region: "Northern Territory",
        country: "Australia",
      },
      location: "Aurora, Northern Territory, Australia",
    });
  });

  it("uses a guarded event-title segment from fetched structured data", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(`<script type="application/ld+json">
          {
            "@type": "Event",
            "name": "Home - International Battery Summit",
            "location": { "address": { "addressLocality": "Chicago" } }
          }
        </script>`),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichEventCandidates([event(3)]);

    expect(enriched.name).toBe("International Battery Summit");
  });

  it("prefers one typed Event description, then a guarded paired OG description", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(`
      <script type="application/ld+json">{ "@type": "Event", "name": "Battery Summit", "description": "Typed summary." }</script>
      <meta property="og:title" content="Battery Summit | Example"><meta property="og:description" content="OG summary.">
    `), { status: 200 })));
    const [typed] = await enrichEventCandidates([event(301)]);
    expect(typed.reportSummary).toEqual({ text: "Typed summary.", authority: "page-owned" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(
      '<meta property="og:title" content="Battery Summit | Example"><meta property="og:description" content="OG summary.">',
    ), { status: 200 })));
    const [og] = await enrichEventCandidates([event(302)]);
    expect(og.reportSummary).toEqual({ text: "OG summary.", authority: "page-owned" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(
      '<meta property="og:title" content="Battery Summit | Example"><meta property="og:description" content="Unfinished metadata",',
    ), { status: 200 })));
    const [unfinished] = await enrichEventCandidates([{ ...event(303), reportSummary: { text: "Source record.", authority: "source-record" } }]);
    expect(unfinished.reportSummary).toEqual({ text: "Source record.", authority: "source-record" });
  });

  it("overrides source-record evidence only with a complete owned page summary", async () => {
    const sourceRecord = { ...event(304), reportSummary: { text: "Source record.", authority: "source-record" as const } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(
      '<script type="application/ld+json">{ "@type": "Event", "name": "Battery Summit", "description": "Complete page summary." }</script>',
    ), { status: 200 })));
    const [typed] = await enrichEventCandidates([sourceRecord]);
    expect(typed.reportSummary).toEqual({ text: "Complete page summary.", authority: "page-owned" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(
      '<meta property="og:title" content="Home | Events"><meta property="og:description" content="OG source summary.">',
    ), { status: 200 })));
    const [rejectedOg] = await enrichEventCandidates([sourceRecord]);
    expect(rejectedOg.reportSummary).toEqual(sourceRecord.reportSummary);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(
      '<script type="application/ld+json">{ "@type": "Event", "name": "Battery Summit", "description": "No ending" }</script>',
    ), { status: 200 })));
    const [unusableTyped] = await enrichEventCandidates([sourceRecord]);
    expect(unusableTyped.reportSummary).toEqual(sourceRecord.reportSummary);
  });

  it("accepts a host-matching typed Event name by its structured provenance", async () => {
    const item = { ...event(31), url: "https://solarpaces.example.org/conference" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(`
      <script type="application/ld+json">{ "@type": "Event", "name": "SolarPACES" }</script>
    `), { status: 200 })));

    const [enriched] = await enrichEventCandidates([item]);
    expect(enriched.name).toBe("SolarPACES");
  });

  // B9-04 Fix 2 (round 9): the typedName rescue term used to call
  // looksLikeEventTitle alone, which bypasses ALL FOUR of isChromeSegment's
  // checks -- so it rescued a typed name for reasons that have nothing to
  // do with the one case above (a host-brand collision). These two prove
  // the narrowed rescue (skipHostBrand) still rejects a typed name that is
  // chrome for an UNRELATED reason, same live-confirmed shapes as B8-06/
  // B9-01. Both must fall through to the raw ingestion name, same as "does
  // not let a heading or multiple declarations replace the ingestion name"
  // above -- proving the fix narrows the rescue rather than only relocating
  // which function performs the same over-wide bypass.
  it("does not rescue a typed name that is chrome for a reason unrelated to host-brand: generic title", async () => {
    const item = event(35);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(`
      <script type="application/ld+json">{ "@type": "Event", "name": "Conference Program" }</script>
    `), { status: 200 })));

    const [enriched] = await enrichEventCandidates([item]);
    expect(enriched.name).toBe(item.name);
  });

  it("does not rescue a typed name that is chrome for a reason unrelated to host-brand: raw filename", async () => {
    const item = event(36);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(`
      <script type="application/ld+json">{ "@type": "Event", "name": "AA ECC10 POSTERS 08072026.xlsx" }</script>
    `), { status: 200 })));

    const [enriched] = await enrichEventCandidates([item]);
    expect(enriched.name).toBe(item.name);
  });

  it("uses one current body declaration instead of a deadline headline", async () => {
    const item = { ...event(32), name: "Abstract submission deadline extended", url: "https://solarpaces.example.org/abstract-submission-deadline-extended" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(`
      <meta property="og:title" content="Abstract submission deadline extended">
      <h2>SolarPACES 2026 Call for Abstracts</h2>
      <p>The 32nd SolarPACES Conference will take place in 2026.</p>
    `), { status: 200 })));

    const [enriched] = await enrichEventCandidates([item]);
    expect(enriched.name).toBe("32nd SolarPACES Conference");
  });

  it("does not let a heading or multiple declarations replace the ingestion name", async () => {
    const headingOnly = event(33);
    const ambiguous = event(34);
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response(usablePage(
      url.endsWith("33")
        ? "<h2>International Battery Summit</h2>"
        : "<p>The Alpha Conference will take place in 2026.</p><p>The Beta Symposium will be held in 2026.</p>",
    ), { status: 200 })));

    const [unchangedHeading, unchangedAmbiguous] = await enrichEventCandidates([headingOnly, ambiguous]);
    expect(unchangedHeading.name).toBe(headingOnly.name);
    expect(unchangedAmbiguous.name).toBe(ambiguous.name);
  });

  it("keeps city coverage above 50% for lean representative event pages", async () => {
    const pages = [
      "cambridge-solid-state-battery-summit.html",
      "dlr-emea2026-workshop.html",
      "icml-event-details.html",
    ].map((name) =>
      readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8"),
    );
    expect(pages.every((html) => html.length < 20 * 1024)).toBe(true);

    const fetchMock = vi.fn(async (url: string) => {
      const index = Number(new URL(url).pathname.slice(1));
      return new Response(pages[index], { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const enriched = await enrichEventCandidates(pages.map((_, index) => event(index)));
    const withCity = enriched.filter((item) => item.place?.city);

    expect(withCity).toHaveLength(2);
    expect(withCity.length / enriched.length).toBeGreaterThanOrEqual(0.5);
    expect(enriched[0]).toMatchObject({
      place: { city: "Chicago", region: "IL" },
      isOnline: true,
    });
  });

  it("fetches only gate survivors, retains candidate 41, and re-scores enrichment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(`<script type="application/ld+json">
          {
            "@type": "Event",
            "location": {
              "address": {
                "addressLocality": "Chicago",
                "addressRegion": "IL",
                "addressCountry": "United States"
              }
            }
          }
        </script>`),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const relevant = Array.from(
      { length: MAX_ENRICHMENT_CANDIDATES + 2 },
      (_, index) => event(index),
    );
    const irrelevant = {
      ...event(999),
      name: "General Marketing Expo",
      description: "Brand strategy and advertising",
      tags: ["marketing"],
    };
    const profile = {
      topics: ["solid-state battery"],
      locations: ["Chicago"],
    };
    const now = Date.UTC(2026, 6, 27);
    const baseline = await scoreEventPoolCandidates(
      [...relevant, irrelevant],
      profile,
      now,
    );
    const enriched = await scoreEventPoolCandidates(
      [...relevant, irrelevant],
      profile,
      now,
      { enrichDetails: true },
    );

    expect(baseline).toHaveLength(relevant.length);
    expect(enriched).toHaveLength(relevant.length);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_ENRICHMENT_CANDIDATES);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/999")),
    ).toBe(false);

    const firstBefore = baseline.find((item) => item.id === relevant[0].id)!;
    const firstAfter = enriched.find((item) => item.id === relevant[0].id)!;
    expect(firstAfter.place?.city).toBe("Chicago");
    expect(firstAfter.score).toBeGreaterThan(firstBefore.score);
    expect(
      enriched.find(
        (item) => item.id === relevant[MAX_ENRICHMENT_CANDIDATES].id,
      )?.place,
    ).toBeUndefined();
  });

  it("wires event attendance details and complete rosters through enrichment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(`
          <script type="application/ld+json">
            {
              "@type": "Event",
              "location": {
                "address": {
                  "addressLocality": "Munich",
                  "addressCountry": "Germany"
                }
              }
            }
          </script>
          <p>Registration closes: 15 June 2027.</p>
          <p>Workshops and poster sessions are followed by a networking reception.</p>
          <p>Student travel grants are available for accepted presenters.</p>
          <p>Registered attendees may request an invitation letter.</p>
          <h2>Sponsors</h2>
          <article class="sponsor-card">
            <h3 class="sponsor-name">Battery Alliance</h3>
          </article>
          <h2>Speakers</h2>
          <article class="speaker-card">
            <h3 class="speaker-name">Maya Chen</h3>
            <p class="role">Chief Scientist</p>
            <p class="institution">Volta Institute</p>
          </article>
        `),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichEventCandidates([event(7)]);

    expect(enriched).toMatchObject({
      registrationDeadline: "2027-06-15",
      activities: ["workshop", "poster session", "networking"],
      travelGrant:
        "Student travel grants are available for accepted presenters.",
      invitationLetter: true,
      organisations: [{ name: "Battery Alliance" }],
      people: [
        {
          name: "Maya Chen",
          role: "Chief Scientist",
          institution: "Volta Institute",
        },
      ],
    });
  });

  // B4-10 (round 4). expectedSize had no producer anywhere before this
  // round; this locks in that it now reaches the merged item.
  it("wires an explicit expected-attendance figure through enrichment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage("<p>Expected attendance: 2,400 professionals.</p>"),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichEventCandidates([event(8)]);

    expect(enriched).toMatchObject({ expectedSize: 2400 });
  });
});

describe("job detail enrichment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps fetch failures unchanged and never derives remote from page format", async () => {
    const failedOriginal = job(1, true);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("Forbidden", { status: 403 }))
      .mockResolvedValueOnce(
        new Response(
          usablePage(`<script type="application/ld+json">
            {
              "@type": "JobPosting",
              "title": "Battery Scientist",
              "jobLocation": {
                "address": {
                  "addressLocality": "Chicago",
                  "addressRegion": "IL",
                  "addressCountry": "United States"
                }
              }
            }
          </script>`),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const [failed, enriched] = await enrichJobCandidates([
      failedOriginal,
      job(2, false),
    ]);

    expect(failed).toBe(failedOriginal);
    expect(enriched).toMatchObject({
      location: "Chicago, IL, United States",
      place: {
        city: "Chicago",
        region: "IL",
        country: "United States",
      },
      isRemote: false,
    });
  });

  it("wires job application, role-kind, and visa details through enrichment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(`
          <script type="application/ld+json">
            {
              "@type": "JobPosting",
              "validThrough": "2027-04-30",
              "jobLocation": {
                "address": {
                  "addressLocality": "Oak Ridge",
                  "addressRegion": "TN",
                  "addressCountry": "US"
                }
              }
            }
          </script>
          <p>Expected start date: 15 June 2027.</p>
          <p>This is a two-year fixed-term appointment.</p>
          <p>Apply with a CV, cover letter, and research statement.</p>
          <p>The laboratory will provide H-1B sponsorship for this role.</p>
        `),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichJobCandidates([job(8)]);

    expect(enriched).toMatchObject({
      applicationDeadline: "2027-04-30",
      startDate: "2027-06-15",
      contractLength: "two-year fixed-term appointment",
      applicationMaterials: [
        "Curriculum vitae",
        "Cover letter",
        "Research statement",
      ],
      roleKind: "staff",
      visa: {
        state: "sponsors",
        evidence:
          "The laboratory will provide H-1B sponsorship for this role.",
        country: "United States",
      },
    });
  });

  it("does not infer a job role kind from page furniture", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(`
          <script type="application/ld+json">
            { "@type": "JobPosting", "jobLocation": { "address": { "addressLocality": "Chicago" } } }
          </script>
          <p>Support laboratory research projects.</p>
          <footer>Postdoctoral fellowship applications are now open.</footer>
        `),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichJobCandidates([
      { ...job(21), title: "Research Assistant" },
    ]);

    expect(enriched.roleKind).toBeUndefined();
  });

  it("retains furniture-stripped fetched text separately for report summaries", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage("<nav>Job filters</nav><p>Develop battery materials for electrochemical systems.</p>"),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichJobCandidates([job(24)]);

    expect(enriched.pageText).toContain("Develop battery materials");
    expect(enriched.pageText).not.toContain("Job filters");
  });

  it("keeps a start-date-flexible signal even when it is the only new fact a page offers", async () => {
    // B3-06. hasExtractedJobSignal must count startDateFlexible on its own —
    // without that, a posting whose only new signal is flexibility would
    // fail the gate and enrichJobCandidates would return the original item
    // unchanged, silently discarding the extracted flag.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(
          "<p>The start date is flexible for the right candidate.</p>",
        ),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichJobCandidates([job(20)]);

    expect(enriched).toMatchObject({ startDateFlexible: true });
  });

  it("wires JSON-LD salary, employment type, and free-text work mode through enrichment", async () => {
    // B4-11.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(`
          <script type="application/ld+json">
            {
              "@type": "JobPosting",
              "employmentType": "FULL_TIME",
              "baseSalary": {
                "currency": "USD",
                "value": { "minValue": 95000, "maxValue": 120000, "unitText": "YEAR" }
              }
            }
          </script>
          <p>This role follows a hybrid schedule, three days on-site.</p>
        `),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichJobCandidates([job(21)]);

    expect(enriched).toMatchObject({
      salaryMin: 95000,
      salaryMax: 120000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      employmentType: "full_time",
      workMode: "hybrid",
    });
  });

  it("keeps a salary-only signal even when it is the only new fact a page offers", async () => {
    // Same bug class B3-06 already fixed for startDateFlexible: without
    // details?.salary in hasExtractedJobSignal's OR-chain, a posting whose
    // only new signal is salary would fail the gate and enrichJobCandidates
    // would return the original item unchanged, silently discarding it.
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(`
          <script type="application/ld+json">
            {
              "@type": "JobPosting",
              "baseSalary": {
                "currency": "USD",
                "value": { "minValue": 95000, "maxValue": 120000, "unitText": "YEAR" }
              }
            }
          </script>
        `),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichJobCandidates([job(22)]);

    expect(enriched).toMatchObject({ salaryMin: 95000, salaryMax: 120000 });
  });

  it("never overwrites a source's own salary with an upstream JSON-LD figure", async () => {
    // B4-11's own note: item.X ?? details?.X only ever fills a gap a source
    // left empty. An Adzuna/USAJobs job that already carries a real salary
    // must keep it even when the fetched page's own JSON-LD states a
    // different figure.
    const original = {
      ...job(23),
      salaryMin: 80000,
      salaryMax: 100000,
      salaryCurrency: "USD" as const,
      salaryPeriod: "year" as const,
    };
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(`
          <script type="application/ld+json">
            {
              "@type": "JobPosting",
              "employmentType": "FULL_TIME",
              "baseSalary": {
                "currency": "USD",
                "value": { "minValue": 200000, "maxValue": 250000, "unitText": "YEAR" }
              }
            }
          </script>
        `),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const [enriched] = await enrichJobCandidates([original]);

    expect(enriched).toMatchObject({
      salaryMin: 80000,
      salaryMax: 100000,
      // employmentType was genuinely absent on the source item, so this one
      // field still upgrades from the fetched page.
      employmentType: "full_time",
    });
  });

  it("leaves a 6 KB JavaScript shell unchanged and does not throw", async () => {
    const original = job(9);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `<html><head><script>${"a".repeat(6 * 1024)}</script></head>` +
          `<body><div id="root"></div></body></html>`,
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    // B7-02: a successful fetch with no selected-posting owner is explicit
    // evidence of an unproven scope, while every source-owned field survives.
    await expect(enrichJobCandidates([original])).resolves.toEqual([
      { ...original, fetchedPostingScope: "unproven" },
    ]);
  });

  it("fetches only job gate survivors, caps at 40, and re-scores location", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        usablePage(`<script type="application/ld+json">
          {
            "@type": "JobPosting",
            "jobLocation": {
              "address": {
                "addressLocality": "Chicago",
                "addressRegion": "IL",
                "addressCountry": "United States"
              }
            }
          }
        </script>`),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const relevant = Array.from(
      { length: MAX_ENRICHMENT_CANDIDATES + 2 },
      (_, index) => job(index),
    );
    const irrelevant = {
      ...job(999),
      title: "General Marketing Manager",
      description: "Brand strategy and advertising",
      tags: ["marketing"],
    };
    const profile = {
      topics: ["solid-state battery"],
      locations: ["Chicago"],
    };
    const now = Date.UTC(2026, 6, 27);
    const baseline = await scoreJobPoolCandidates(
      [...relevant, irrelevant],
      profile,
      now,
    );
    const enriched = await scoreJobPoolCandidates(
      [...relevant, irrelevant],
      profile,
      now,
      { enrichDetails: true },
    );

    expect(baseline).toHaveLength(relevant.length);
    expect(enriched).toHaveLength(relevant.length);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_ENRICHMENT_CANDIDATES);
    expect(
      fetchMock.mock.calls.some(([url]) => String(url).endsWith("/999")),
    ).toBe(false);

    const firstBefore = baseline.find((item) => item.id === relevant[0].id)!;
    const firstAfter = enriched.find((item) => item.id === relevant[0].id)!;
    expect(firstAfter.place?.city).toBe("Chicago");
    expect(firstAfter.score).toBeGreaterThan(firstBefore.score);
    expect(
      enriched.find(
        (item) => item.id === relevant[MAX_ENRICHMENT_CANDIDATES].id,
      )?.place,
    ).toBeUndefined();
  });
});

// B18-02 (round 18, Rulings 50c + 51c): THE PROVIDER-TRUNCATED ROLE TITLE.
// A job card's role title rendered as `Actinide Chemistry/Ion Exchange Postdoc
// Research ...` on 5 pulls out of 5, while the posting's own page carries the
// whole thing in its first <h1>. The truncation is the PROVIDER's — the same
// string arrives on four different hosts (`linkedin.com`, `talent.com`,
// `xtalks.com`, `bebee.com`), so it is not one site's quirk.
//
// THIS IS NOT B4-01's R8 EVENT FIX PORTED, AND THAT WAS SETTLED BY EXECUTION:
// the job path never calls `extractOpportunityPageDetails`; that function
// refuses a typed name unless `kind === "event"`; and `enrichJobCandidates`
// returns early on an `unproven` scope, which is what A's row actually is. A
// straight port would have been INERT on the exact row it was meant to fix.
//
// The repair never REPLACES a title — it only EXTENDS one the page
// demonstrably continues. The <h1> must literally BEGIN with the truncated
// stem, which is what makes it a per-field ownership witness rather than a
// guess.
describe("provider-truncated role title repair (B18-02)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  const TRUNCATED = "Actinide Chemistry/Ion Exchange Postdoc Research ...";
  const FULL = "Actinide Chemistry/Ion Exchange Postdoc Research Associate";

  function truncatedJob(overrides: Partial<RawJobItem> = {}): RawJobItem {
    return {
      ...job(30),
      title: TRUNCATED,
      company: "Savannah River National Laboratory",
      url: "https://jobs.example.com/role",
      ...overrides,
    };
  }

  /**
   * A page that FETCHES but whose posting scope is `unproven` — no selected
   * posting owner anywhere in it. This is A's actual row: all three live
   * `linkedin.com` rows measured `unproven`, 3 of 3, so the repair has to
   * survive the early return or it can never reach the defect.
   */
  function unprovenPageWithHeading(heading: string): string {
    return (
      `<html><body><h1>${heading}</h1>` +
      `<script>${"a".repeat(6 * 1024)}</script>` +
      `<div id="root"></div></body></html>`
    );
  }

  function stubPage(html: string | null) {
    const fetchMock = vi.fn().mockResolvedValue(
      html === null
        ? new Response("Forbidden", { status: 403 })
        : new Response(html, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("extends a truncated title from the page's own first heading", async () => {
    stubPage(usablePage(`<h1>${FULL}</h1>`));
    const [enriched] = await enrichJobCandidates([truncatedJob()]);
    expect(enriched.title).toBe(FULL);
  });

  // THE ASSERTION THAT FAILS IF THE REPAIR IS PLACED BELOW THE EARLY RETURN.
  // This is A's actual row, and the reason the event fix's position is
  // unreachable here.
  it("survives the unproven-scope early return", async () => {
    stubPage(unprovenPageWithHeading(FULL));
    const [enriched] = await enrichJobCandidates([truncatedJob()]);
    expect(enriched.fetchedPostingScope).toBe("unproven");
    expect(enriched.title).toBe(FULL);
  });

  // THE EMPLOYER-PREFIXED PAGE TITLE. LinkedIn's own <title> and og:title both
  // take this shape, which is exactly why they are NOT used as inputs: they do
  // not begin with the stem, so the containment test rejects them. A naive
  // "prefer the page's title" port would have corrupted the card here.
  it("refuses a heading prefixed by the employer", async () => {
    stubPage(
      unprovenPageWithHeading(
        "Savannah River National Laboratory hiring Actinide Chemistry/Ion Exchange Postdoc Research Associate in Aiken, SC",
      ),
    );
    const [enriched] = await enrichJobCandidates([truncatedJob()]);
    expect(enriched.title).toBe(TRUNCATED);
  });

  it("refuses a heading belonging to a different posting", async () => {
    stubPage(
      unprovenPageWithHeading("Molten Salt Electrochemistry Postdoctoral Researcher"),
    );
    const [enriched] = await enrichJobCandidates([truncatedJob()]);
    expect(enriched.title).toBe(TRUNCATED);
  });

  it("leaves a title with no ellipsis alone even when the heading differs", async () => {
    stubPage(unprovenPageWithHeading("A Completely Different Role Title Here"));
    const [enriched] = await enrichJobCandidates([
      truncatedJob({ title: "Actinide Chemistry Postdoc Research Associate" }),
    ]);
    expect(enriched.title).toBe("Actinide Chemistry Postdoc Research Associate");
  });

  // COMMENT-ONLY CORRECTION BY B19-02 (Ruling 53b). THE ASSERTION IS
  // DELIBERATELY UNCHANGED and this test still passes — but after B19-02 its
  // NAME promises more than it tests. "No heading at all" is no longer enough
  // to leave a title alone; the page must also carry no usable `<title>`. This
  // fixture happens to have neither, which is the ONLY reason it stays green.
  // Read it as "no witness of any kind", not as coverage of the no-`<h1>` case.
  // The case where a `<title>` IS present is asserted in the B19-02 block below.
  it("leaves the title alone when the page has no heading at all", async () => {
    stubPage(`<html><body><div id="root"></div></body></html>`);
    const [enriched] = await enrichJobCandidates([truncatedJob()]);
    expect(enriched.title).toBe(TRUNCATED);
  });

  // No page fetched means no witness, so `if (!html) return item;` correctly
  // does NOT carry a repair — the one return path of the four that must not.
  it("leaves the title alone when the page does not fetch", async () => {
    stubPage(null);
    const [enriched] = await enrichJobCandidates([truncatedJob()]);
    expect(enriched.title).toBe(TRUNCATED);
  });

  it("handles the single-character ellipsis identically to three dots", async () => {
    stubPage(unprovenPageWithHeading("Research Associate in Molten Salt Chemistry"));
    const [enriched] = await enrichJobCandidates([
      truncatedJob({ title: "Research Associate…" }),
    ]);
    expect(enriched.title).toBe("Research Associate in Molten Salt Chemistry");
  });

  // THE 12-CHARACTER STEM FLOOR. Without it, a provider's generic `Jobs ...`
  // would be "extended" by any heading that happens to start `Jobs at …`.
  // DO NOT RELAX THIS.
  it("refuses to extend a stem shorter than twelve characters", async () => {
    stubPage(unprovenPageWithHeading("Jobs at Acme Corporation — Browse All Openings"));
    const [enriched] = await enrichJobCandidates([truncatedJob({ title: "Jobs ..." })]);
    expect(enriched.title).toBe("Jobs ...");
  });

  // B NAMED THE THIRD RETURN PATH AS THE ROUND'S MOST LIKELY MISTAKE, AND C
  // MEASURED THAT IT IS NOT REACHABLE — SO THIS TEST IS HONEST ABOUT WHAT IT
  // ACTUALLY COVERS. Reverting that line to a bare `item` turns NOTHING red,
  // and an instrumented `throw` in its place never fired across the whole
  // 1311-test `src/lib/` suite: whenever the scope is owned, `pageText` is
  // non-empty, so `hasExtractedJobSignal` is always true and the branch
  // short-circuits away. The line still carries the repair (it is correct if
  // that contract ever changes) but NO test protects it and none can. What
  // this test does cover is the FINAL MERGED OBJECT on a scope-owned page that
  // carries nothing else new — proven by the negative proof, where removing
  // `title` from that object turns this test red.
  it("keeps the repair on a scope-owned posting with nothing else new", async () => {
    stubPage(
      usablePage(
        `<h1>${FULL}</h1><script type="application/ld+json">{ "@type": "JobPosting" }</script>`,
      ).replace(/<main>[\s\S]*<\/main>/, "<main>Short.</main>"),
    );
    const [enriched] = await enrichJobCandidates([truncatedJob()]);
    expect(enriched.title).toBe(FULL);
  });

  // MUST-KEEP, AND IT IS THE CLAIM THE BRIEF ASKED ABOUT. The employer chain
  // has ZERO exposure — `resolveEmployerIdentity` takes no title argument at
  // all, so this is not "the risk is small", it is "the code path does not
  // exist". Asserted on the VALUE, not on "does not throw".
  it("leaves the resolved employer identical to the unrepaired row", async () => {
    stubPage(usablePage(`<h1>${FULL}</h1>`));
    const [repaired] = await enrichJobCandidates([truncatedJob()]);

    vi.unstubAllGlobals();
    stubPage(usablePage("<h1>Some Unrelated Heading</h1>"));
    const [unrepaired] = await enrichJobCandidates([truncatedJob()]);

    expect(repaired.title).toBe(FULL);
    expect(unrepaired.title).toBe(TRUNCATED);
    expect(repaired.company).toBe(unrepaired.company);
    expect(repaired.company).toBe("Savannah River National Laboratory");
  });

  // THE SCOPE CALL IS UNAFFECTED, WHICH IS THE WHOLE REASON THE REPAIR SITS
  // AFTER IT. `resolveJobPostingScope` takes the title as an ownership witness,
  // so repairing FIRST would widen which pages may donate pageText, employer
  // and the summary — measured as a real cost for zero measured gain on real
  // rows. Ruling 51c keeps that widening as a recorded lead, not part of this
  // item. This asserts the ownership verdict is the truncated title's.
  it("does not let the repair widen the posting scope", async () => {
    stubPage(unprovenPageWithHeading(FULL));
    const [enriched] = await enrichJobCandidates([truncatedJob()]);
    expect(enriched.fetchedPostingScope).toBe("unproven");
    expect(enriched.pageText).toBeUndefined();
  });

  // NAMED UNDER-CATCH, asserted as documented-known. The repair fires on 1 of
  // the 4 real truncated rows: `talent.com` and `bebee.com` return null from
  // `fetchPageHtml`, and `xtalks.com` fetches but has no <h1> at all. On all
  // three the result is today's value exactly. It is also bounded by
  // MAX_ENRICHMENT_CANDIDATES — rows past position 40 never get a page.
  //
  // COMMENT-ONLY CORRECTION BY B19-02 (Ruling 53b). THE ASSERTION IS
  // DELIBERATELY UNCHANGED and still passes — but the under-catch it documents
  // has NARROWED, and this test's fixture no longer demonstrates the whole of
  // it. The under-catch is now "no `<h1>` AND no usable `<title>`". This
  // fixture carries no `<title>`, which is the only reason it stays green.
  //
  // WHAT MOVED, HOST BY HOST: `talent.com` and `bebee.com` are UNCHANGED — no
  // page fetches, so there is no witness of any kind. Rows past
  // MAX_ENRICHMENT_CANDIDATES are UNCHANGED for the same reason.
  // `xtalks.com` is EXACTLY the class B19-02 newly reaches, but whether its own
  // `<title>` passes containment is UNMEASURED — that host is a standing
  // exclusion and was deliberately not fetched. Do not record this item as
  // closing it.
  it("documents the accepted under-catch: a page with no heading is left alone", async () => {
    stubPage(usablePage("<p>No heading anywhere on this page.</p>"));
    const [enriched] = await enrichJobCandidates([truncatedJob()]);
    expect(enriched.title).toBe(TRUNCATED);
  });

  // B19-02 (round 19, Rulings 52a + 53a): THE PAGE `<title>` AS A SECOND
  // WITNESS, BEHIND THE IDENTICAL GATE.
  //
  // `careers.dupont.com` put a role title ending in a literal ellipsis on a
  // card in 5 pulls of 5 — a FOURTH host, outside B18-02's three documented
  // under-catches. A measured which gate rejected the repair rather than
  // guessing: the page fetches, the 57-character stem clears the 12-character
  // floor, and the page has NO `<h1>` ELEMENT AT ALL. So the mechanism was the
  // documented one; what made it an item is that the page's own `<title>`
  // carries the continuation AND strictly prefix-matches the stem.
  //
  // ROUND 18's REASON FOR REFUSING THE `<title>` WAS RE-MEASURED, NOT ASSUMED
  // AWAY, and it CANNOT MATERIALISE — for a structural reason, not a lucky one.
  // An employer-prefixed string does not BEGIN with the stem, so the same
  // containment test that rejects a different posting's `<h1>` rejects it. That
  // is asserted below, including in the hard case where there is no `<h1>` to
  // fall back on. `extendTruncatedTitle` is NOT touched.
  //
  // THE OTHER HALF OF ROUND 18's WARNING WAS RIGHT: the brand tail is real, and
  // containment cannot catch it because containment only checks the FRONT of a
  // string. Hence the cut — and the cut is NOT a blind `split()[0]`.
  describe("the page <title> as a second witness (B19-02, Rulings 52a + 53a)", () => {
    const DUPONT_TRUNCATED =
      "Process R&D Senior Scientist job in Wilmington, Delaware, ...";
    const DUPONT_PAGE_TITLE =
      "Process R&D Senior Scientist job in Wilmington, Delaware, United States of America | Science & Technology jobs at Dupont";
    const DUPONT_REPAIRED =
      "Process R&D Senior Scientist job in Wilmington, Delaware, United States of America";

    /** A page that fetches, resolves `unproven`, and carries a `<title>`. */
    function unprovenPageWithTitle(title: string, heading?: string): string {
      return (
        `<html><head><title>${title}</title></head><body>` +
        (heading ? `<h1>${heading}</h1>` : "") +
        `<script>${"a".repeat(6 * 1024)}</script>` +
        `<div id="root"></div></body></html>`
      );
    }

    function dupontJob(overrides: Partial<RawJobItem> = {}): RawJobItem {
      return {
        ...job(31),
        title: DUPONT_TRUNCATED,
        company: "DuPont",
        description: "Ion exchange and battery materials process research",
        url: "https://jobs.example.com/role",
        tags: ["ion exchange"],
        ...overrides,
      };
    }

    // 1. A19-02's SHAPE. The exact string is asserted, not `toContain`, because
    // the whole point of the cut is what is ABSENT from the end.
    it("repairs A19-02's row from the page <title>, cut before the brand tail", async () => {
      stubPage(unprovenPageWithTitle(DUPONT_PAGE_TITLE));
      const [enriched] = await enrichJobCandidates([dupontJob()]);
      expect(enriched.title).toBe(DUPONT_REPAIRED);
    });

    // 2. THE SAME, ASSERTED ON THE RENDERED VALUE, so the brand tail cannot
    // slip back in through the mapper. B measured the raw form all the way to
    // the card and it rendered the site's own careers slogan as the role title;
    // Ruling 23 ranks that as wrong data, above missing data.
    it("renders the repaired title on the card WITHOUT the site's brand tail", async () => {
      stubPage(unprovenPageWithTitle(DUPONT_PAGE_TITLE));
      const [enriched] = await enrichJobCandidates([dupontJob()]);
      const [scored] = scoreJobs([enriched], { topics: ["ion exchange", "battery"] });
      const card = scoredJobToJob(scored);
      expect(card.roleTitle).toBe(DUPONT_REPAIRED);
      expect(card.roleTitle).not.toContain("Science & Technology jobs at Dupont");
      expect(card.roleTitle).not.toContain("|");
    });

    // 3. THE RISK THAT MOTIVATED THE h1-ONLY RULE, RE-ASSERTED AGAINST THE NEW
    // CODE PATH — AND IN ITS HARD FORM, WITH NO `<h1>` TO FALL BACK ON. This is
    // round 18's own reason for refusing the `<title>`, and it is the proof
    // that the reason is structural: containment rejects an employer prefix
    // because such a string does not begin with the stem.
    it("refuses an employer-prefixed <title> even when the page has no <h1>", async () => {
      stubPage(
        unprovenPageWithTitle(
          "DuPont hiring Process R&D Senior Scientist in Wilmington, Delaware, United States of America",
        ),
      );
      const [enriched] = await enrichJobCandidates([dupontJob()]);
      expect(enriched.title).toBe(DUPONT_TRUNCATED);
    });

    // 4. THE LEAK TEST, AND THE ONE SHAPE THAT SEPARATES THE NARROW CALL SITE
    // FROM THE WIDE ONE. A wrong `<h1>` is present, so the `<h1>` wins outright
    // and the `<title>` is never consulted. GO RED HERE AND THE CALL SITE HAS
    // BEEN WIDENED TO `<h1>`-first-then-`<title>` — which Ruling 53a declined.
    it("does not consult the <title> when a WRONG <h1> is present", async () => {
      stubPage(unprovenPageWithTitle(DUPONT_PAGE_TITLE, "Careers at DuPont"));
      const [enriched] = await enrichJobCandidates([dupontJob()]);
      expect(enriched.title).toBe(DUPONT_TRUNCATED);
    });

    // 5. THE `<h1>` STILL WINS, byte-identically to today, when both exist.
    it("repairs from the <h1> when both an <h1> and a <title> are present", async () => {
      stubPage(
        unprovenPageWithTitle(
          "DuPont hiring Process R&D Senior Scientist",
          DUPONT_REPAIRED,
        ),
      );
      const [enriched] = await enrichJobCandidates([dupontJob()]);
      expect(enriched.title).toBe(DUPONT_REPAIRED);
    });

    // 6–11. THE MUST-KEEPS. Every one of these passes on the SHIPPED code too —
    // they are regression locks, NOT evidence the new path works. Only tests 1,
    // 2 and the separator-crossing one below are that.
    it.each([
      ["the <title> is the site brand only", "Jobright: Your AI Job Search Copilot"],
      ["the <title> belongs to a different posting", "Molten Salt Electrochemistry Postdoctoral Researcher | DuPont"],
      ["the <title> equals the stem and is not strictly longer", "Process R&D Senior Scientist job in Wilmington, Delaware,"],
    ])("leaves the title alone when %s", async (_label, pageTitle) => {
      stubPage(unprovenPageWithTitle(pageTitle));
      const [enriched] = await enrichJobCandidates([dupontJob()]);
      expect(enriched.title).toBe(DUPONT_TRUNCATED);
    });

    // 9. THE 12-CHARACTER FLOOR IS SHARED, and this proves it still applies on
    // the new path. Without it, `Jobs ...` would be "extended" by any page
    // whose title happens to start `Jobs at …`.
    it("still applies the 12-character floor on the <title> path", async () => {
      stubPage(unprovenPageWithTitle("Jobs at DuPont in Wilmington, Delaware"));
      const [enriched] = await enrichJobCandidates([dupontJob({ title: "Jobs ..." })]);
      expect(enriched.title).toBe("Jobs ...");
    });

    // 10. NO ELLIPSIS MEANS NO REPAIR, even when the `<title>` differs.
    it("leaves a title with no ellipsis alone even when the <title> continues it", async () => {
      stubPage(unprovenPageWithTitle(DUPONT_PAGE_TITLE));
      const [enriched] = await enrichJobCandidates([
        dupontJob({ title: "Process R&D Senior Scientist" }),
      ]);
      expect(enriched.title).toBe("Process R&D Senior Scientist");
    });

    // 11. THE NEW NAMED UNDER-CATCH: no `<h1>` and no `<title>` means no
    // witness exists at all.
    it("documents the new under-catch: no <h1> and no <title>", async () => {
      stubPage(
        `<html><body><script>${"a".repeat(6 * 1024)}</script><div id="root"></div></body></html>`,
      );
      const [enriched] = await enrichJobCandidates([dupontJob()]);
      expect(enriched.title).toBe(DUPONT_TRUNCATED);
    });

    // 12. THE SEPARATOR-CROSSING CASE. THIS IS THE ASSERTION THAT FAILS IF THE
    // CUT IS EVER IMPLEMENTED AS A BLIND `split(sep)[0]`: the first boundary
    // yields `Battery Cell Engineer`, which is SHORTER than the stem and repairs
    // nothing. Walking the boundaries crosses the separator inside the real
    // title and stops at the one that starts the chrome.
    it("crosses a separator INSIDE the real title and stops before the chrome", async () => {
      stubPage(
        unprovenPageWithTitle("Battery Cell Engineer - Gigafactory Berlin | Tesla Careers"),
      );
      const [enriched] = await enrichJobCandidates([
        dupontJob({ title: "Battery Cell Engineer - Gigafactory ...", company: "Tesla" }),
      ]);
      expect(enriched.title).toBe("Battery Cell Engineer - Gigafactory Berlin");
    });

    // 13 + 14. THE MUST-KEEPS THAT ARE NOT ABOUT THE TITLE AT ALL: the employer
    // chain and ownership. `resolveEmployerIdentity` takes ONE argument and its
    // argument object has no `title` field — the code path simply does not
    // exist — and the repair still sits AFTER `resolveJobPostingScope`, so
    // Ruling 51c's `owned`-widening is still NOT bolted on. Asserted on the
    // VALUES, not on "does not throw".
    it("changes neither the employer nor the ownership of the repaired row", async () => {
      stubPage(unprovenPageWithTitle(DUPONT_PAGE_TITLE));
      const [enriched] = await enrichJobCandidates([dupontJob()]);
      expect(enriched.title).toBe(DUPONT_REPAIRED);
      expect(enriched.company).toBe("DuPont");
      expect(enriched.fetchedPostingScope).toBe("unproven");
      expect(enriched.pageText).toBeUndefined();
    });

    // THE DISCLOSED PRICE, ASSERTED SO IT SITS IN A TEST RATHER THAN ONLY IN A
    // LOG. A longer title dilutes the length-normalised term density, so the
    // score MOVES DOWN. B measured 0.7209 → 0.7160 on its own row (and 0.7107
    // for the rejected raw form — the cut form moves roughly half as far, a
    // third independent reason to prefer it). C re-measured the same direction
    // and the same ordering on this fixture; the exact digits belong to
    // whichever row is scored, so what is LOCKED here is the contract: the
    // score moves down, it moves only slightly, and NOTHING is lost from the
    // match reason. If a later change ever RAISES the score or drops a keyword,
    // this goes red.
    it("discloses the score cost: it moves DOWN, slightly, and keeps every keyword", async () => {
      const opts = { topics: ["ion exchange", "battery"] };
      stubPage(unprovenPageWithTitle(DUPONT_PAGE_TITLE));
      const [repaired] = await enrichJobCandidates([dupontJob()]);
      const [before] = scoreJobs([dupontJob()], opts);
      const [after] = scoreJobs([repaired], opts);
      expect(repaired.title).toBe(DUPONT_REPAIRED);
      expect(after.score).toBeLessThan(before.score);
      expect(before.score - after.score).toBeLessThan(0.02);
      expect(after.matchedKeywords).toEqual(before.matchedKeywords);
    });

    // THE ITEM'S ONE CONSTRUCTED NEW RISK CLASS, ASSERTED SO THE PRICE IS IN A
    // TEST. A job board's own `<title>` can legitimately begin with the role
    // and continue into listing chrome. NEITHER the raw nor the cut form leaves
    // it alone, and the cut form's answer is `Research Associate Jobs`. It is
    // CONSTRUCTED; the catch above is LIVE 5 of 5.
    //
    // A `LISTING_TITLE_RE` guard against exactly this was priced and
    // DELIBERATELY NOT SHIPPED: under the cut form it fires on nothing, so it
    // would be a guard no test could turn red — the vacuity round 18 C's
    // standard forbids. Do not re-derive it.
    it("names its own cost: a board's listing chrome can survive the cut", async () => {
      stubPage(
        unprovenPageWithTitle("Research Associate Jobs - 1,204 vacancies | JobBoard.com"),
      );
      const [enriched] = await enrichJobCandidates([
        dupontJob({ title: "Research Associate ...", company: "JobBoard" }),
      ]);
      expect(enriched.title).toBe("Research Associate Jobs");
    });
  });
});

// A23-04 / Ruling 62c. Enrichment RECORDS the page's kind on the item the way
// it already records `fetchedPostingScope`. Recording is not deciding: the
// check that reads it lives at the post-enrichment gate and needs the URL
// clause to agree before any row is removed.
describe("A23-04 — enrichment records the page kind", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("records `article` when the page declares itself one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          '<html><head><meta property="og:type" content="article"></head><body>' +
            `<main>${"University news about internships. ".repeat(200)}</main>` +
            "</body></html>",
          { status: 200 },
        ),
      ),
    );

    const [enriched] = await enrichJobCandidates([job(21)]);
    expect(enriched.fetchedPageKind).toBe("article");
  });

  it("records nothing for an ordinary posting page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          '<html><head><meta property="og:type" content="website"></head><body>' +
            usablePage(
              '<script type="application/ld+json">{"@type":"JobPosting","title":"Solid-State Battery Research Scientist 22"}</script>',
            ) +
            "</body></html>",
          { status: 200 },
        ),
      ),
    );

    const [enriched] = await enrichJobCandidates([job(22)]);
    expect(enriched.fetchedPageKind).toBeUndefined();
  });

  it("records it even when the page cannot prove it owns the posting", async () => {
    // Computed ABOVE the `unproven` early return: a page that fails the
    // ownership test can still declare itself an article, and a signal recorded
    // below that return could never reach those rows.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          '<html><head><meta property="og:type" content="article"></head>' +
            "<body><p>Nothing here proves ownership.</p></body></html>",
          { status: 200 },
        ),
      ),
    );

    const [enriched] = await enrichJobCandidates([job(23)]);
    expect(enriched.fetchedPostingScope).toBe("unproven");
    expect(enriched.fetchedPageKind).toBe("article");
  });
});
