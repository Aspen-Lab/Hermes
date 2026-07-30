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

describe("event detail enrichment", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("caps detail requests at 40 gate-surviving candidates", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const index = new URL(url).pathname.slice(1);
      return new Response(
        `<script type="application/ld+json">
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
        </script>`,
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
          `<meta property="og:title"
             content="Solid-State Battery Summit | August 11-12, 2026 | Chicago, IL + Virtual">`,
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

  it("fetches only gate survivors, retains candidate 41, and re-scores enrichment", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `<script type="application/ld+json">
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
        </script>`,
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
          `<script type="application/ld+json">
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
          </script>`,
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

  it("fetches only job gate survivors, caps at 40, and re-scores location", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        `<script type="application/ld+json">
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
        </script>`,
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
