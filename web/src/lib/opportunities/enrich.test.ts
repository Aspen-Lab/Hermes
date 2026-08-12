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

function event(index: number): RawEventItem {
  return {
    id: `eventweb:${index}`,
    source: "eventweb",
    name: `Battery Event ${index}`,
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
    url: `https://jobs.example.com/${index}`,
    postedAt: "2026-07-20",
    tags: ["solid-state battery"],
  };
}

function usablePage(content: string): string {
  return `${content}<main>${"Detailed opportunity information. ".repeat(800)}</main>`;
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
    // wins over the pre-fetch ingestion guess ("Battery Event 0") once it
    // clears the title-shape guard — this fixture's name is a plain string,
    // so it passes and is preferred, same as a real page's own title would be.
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

  it("accepts a host-matching typed Event name by its structured provenance", async () => {
    const item = { ...event(31), url: "https://solarpaces.example.org/conference" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(usablePage(`
      <script type="application/ld+json">{ "@type": "Event", "name": "SolarPACES" }</script>
    `), { status: 200 })));

    const [enriched] = await enrichEventCandidates([item]);
    expect(enriched.name).toBe("SolarPACES");
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

    await expect(enrichJobCandidates([original])).resolves.toEqual([original]);
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
