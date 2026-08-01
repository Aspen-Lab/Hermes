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
    expect(enriched[0]).toMatchObject({
      name: "Battery Event 0",
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
