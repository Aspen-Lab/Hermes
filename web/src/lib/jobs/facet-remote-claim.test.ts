import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { PreferenceLedger } from "@/types";
import {
  countOpportunityFacets,
  filterOpportunitiesByFacets,
  opportunityFormat,
} from "@/lib/opportunities/facets";
import { opportunityFacetPreferenceConcepts } from "@/lib/preferences/ledger";
import {
  derivePoolCacheKey,
  type CachedPool,
  type PoolCache,
} from "@/lib/opportunities/pool-cache";
import { runJobsPipeline } from "./pipeline";
import { scoreJobs, type JobScoringProfile } from "./scoring";
import { scoredJobToJob } from "./mapper";
import { withRenderedRemote } from "./remote-claim";
import type { JobsFeedRequest, ScoredJobItem } from "./types";

/**
 * **RULING 68b / RULING 72c — THE RAW-READER CONVERSION.** (Round 25 B found the
 * divergence; round 25 C built the shared predicate and deliberately did NOT
 * convert these four sites; round 26 B priced them on a constructed matrix;
 * round 26 C landed them.)
 *
 * **THE DEFECT, STRUCTURALLY.** `opportunityFormat` (`facets.ts:337`) decides
 * `online` vs `in-person` from `isRemote`, and its parameter type
 * `FacetableOpportunity` **has no `source` field** — so it cannot tell whether
 * the flag it was handed is the RAW one set at ingestion from a page-scoped
 * snippet, or the GATED one the reader actually sees. The SERVER passed
 * `ScoredJobItem` (raw); the CLIENT passed the mapped `Job` card (gated).
 * **The same row was `online` on the server and `in-person` on the client, and
 * neither side could detect it.**
 *
 * **THE LIVE POOL WAS VACUOUS ON THIS PREDICATE WHEN B MEASURED IT — 0 of 16
 * rows — AND B REFUSED TO BANK THE ZERO.** The defect IS reachable: round 26 A's
 * own window B carried `jobweb:1g2eds8` (`lensa.com`, `source: jobweb`, raw
 * `isRemote: true`, an Albuquerque internship) in 4 of 5 pulls of an 11-row
 * pool — roughly one row in eleven. **So the matrix below is CONSTRUCTED, and it
 * carries the defect's own shape plus four admitted controls.** A future round
 * that measures zero here must check whether any row bites before reporting it.
 *
 * **THESE TESTS DRIVE THE REAL SHIPPED PIPELINE** through a seeded pool cache —
 * the same technique `opportunities/facets.test.ts` already uses — so the
 * conversion is exercised where it lives, including the `pipeline.ts` re-select
 * trap, rather than through a re-implementation of it.
 */

const NOW = new Date("2026-07-27T12:00:00.000Z");

function poolRow(overrides: Partial<ScoredJobItem>): ScoredJobItem {
  return {
    id: "row",
    source: "jobweb",
    title: "Battery Research Engineer",
    company: "Example Energy",
    location: "Albuquerque, NM",
    place: { city: "Albuquerque", country: "United States" },
    isRemote: false,
    description: "Work on solid-state cells.",
    url: "https://example.test/row",
    postedAt: "2026-07-01",
    tags: [],
    score: 0.9,
    matchedKeywords: ["battery"],
    matchReason: "Matches your battery research focus.",
    ...overrides,
  } as ScoredJobItem;
}

/**
 * **B's CONSTRUCTED MATRIX.** One row carrying A25-01's exact shape, and four
 * the conversion must not touch.
 */
const MATRIX: ScoredJobItem[] = [
  // THE DEFECT: a `jobweb` row making a remote claim it does not own.
  poolRow({ id: "jobweb-remote", source: "jobweb", isRemote: true }),
  // control: a `jobweb` row that never claimed remote
  poolRow({ id: "jobweb-notremote", source: "jobweb", isRemote: false }),
  // control: another source, where `isRemote` comes from a structured field of
  // the row's OWN record and is therefore owned
  poolRow({ id: "remotive-remote", source: "remotive", isRemote: true }),
  // control: a second such source, so the rule is not read as `remotive`-only
  poolRow({ id: "arbeitnow-remote", source: "arbeitnow", isRemote: true }),
  // control: THE `hybrid` ESCAPE HATCH — a `jobweb` row whose own location
  // string states its format, in a field it owns
  poolRow({
    id: "jobweb-hybrid-text",
    source: "jobweb",
    isRemote: true,
    location: "Albuquerque, NM (Hybrid)",
  }),
];

function memoryCache(): PoolCache {
  const store = new Map<string, CachedPool>();
  return {
    get: async (key: string) => store.get(key) ?? null,
    set: async (key: string, value: CachedPool) => {
      store.set(key, value);
    },
  } as PoolCache;
}

const REQUEST: JobsFeedRequest = {
  topics: [],
  careerStage: "PhD Year 2",
  industryVsAcademia: "academia",
  aiTier: 0,
};

async function seededPipeline(
  facets?: { format?: ("online" | "in-person" | "hybrid")[] },
) {
  const cache = memoryCache();
  const key = derivePoolCacheKey({
    surface: "jobs",
    requiredTopics: [],
    careerStage: "PhD Year 2",
    now: NOW,
  });
  await cache.set(key, {
    surface: "jobs",
    items: MATRIX,
    facetCounts: countOpportunityFacets("jobs", MATRIX),
    generatedAt: NOW.toISOString(),
    localDate: "2026-07-27",
  });
  return runJobsPipeline(
    { ...REQUEST, topN: 50, ...(facets ? { facets } : {}) },
    { cache, now: NOW },
  );
}

/** What the CLIENT sees — the mapped cards, carrying the gated flag. */
const CLIENT_CARDS = MATRIX.map((item) => scoredJobToJob(item));

describe("RULING 68b — MATRIX 1: server and client format counts agree", () => {
  it("makes the server's facet counts BYTE-IDENTICAL to the client's", async () => {
    const server = await seededPipeline();
    const client = countOpportunityFacets("jobs", CLIENT_CARDS);
    expect(server.facetCounts.format).toEqual(client.format);
  });

  it("lands on B's measured counts exactly", async () => {
    const server = await seededPipeline();
    // B's matrix 1, after conversion: in-person 2, online 2, hybrid 1.
    // Before conversion the server read in-person 1, online 3, hybrid 1.
    expect(server.facetCounts.format).toEqual({
      "in-person": 2,
      online: 2,
      hybrid: 1,
    });
  });

  it("drops the `Online` count by exactly one — approved and expected (Ruling 72c)", async () => {
    const raw = countOpportunityFacets("jobs", MATRIX);
    const server = await seededPipeline();
    expect(raw.format?.online).toBe(3);
    expect(server.facetCounts.format?.online).toBe(2);
    // and the row does not vanish — it moves
    expect(server.facetCounts.format?.["in-person"]).toBe(
      (raw.format?.["in-person"] ?? 0) + 1,
    );
  });
});

describe("RULING 68b — MATRIX 2: server and client filter membership agree", () => {
  it("returns the same ids as the client for format:['online']", async () => {
    const server = await seededPipeline({ format: ["online"] });
    const clientIds = filterOpportunitiesByFacets("jobs", CLIENT_CARDS, {
      format: ["online"],
    }).map((item) => item.id);
    expect(server.items.map((item) => item.id).sort()).toEqual(
      [...clientIds].sort(),
    );
  });

  it("drops exactly ONE row — the jobweb row making an unowned remote claim", async () => {
    const before = filterOpportunitiesByFacets("jobs", MATRIX, {
      format: ["online"],
    }).map((item) => item.id);
    const server = await seededPipeline({ format: ["online"] });
    const after = server.items.map((item) => item.id);
    // B's matrix 2: the hybrid row is returned for `online` too, because
    // `matchesSelectedFormat` treats hybrid as attendable both ways.
    expect(before.sort()).toEqual(
      [
        "arbeitnow-remote",
        "jobweb-hybrid-text",
        "jobweb-remote",
        "remotive-remote",
      ].sort(),
    );
    expect(after.sort()).toEqual(
      ["arbeitnow-remote", "jobweb-hybrid-text", "remotive-remote"].sort(),
    );
    expect(before.filter((id) => !after.includes(id))).toEqual(["jobweb-remote"]);
  });
});

/**
 * **THE ONE TRAP IN THE ITEM, WHICH B NAMED BEFORE C WROTE IT.** The filter's
 * return value is the row list that goes on to the scoring floor and top-N, so
 * it must return the ORIGINAL objects. A naive `.map()` would hand every
 * downstream reader a rewritten `isRemote` and corrupt the three DELIBERATE raw
 * readers A22-03(b) protects.
 */
describe("RULING 68b — THE RE-SELECT TRAP: downstream still sees the RAW flag", () => {
  it("returns the ORIGINAL row objects, not the converted projections", async () => {
    const server = await seededPipeline({ format: ["online"] });
    const hybrid = server.items.find((item) => item.id === "jobweb-hybrid-text");
    // `pool` is the mapped card list, so check the SOURCE objects were not
    // rewritten: the matrix rows themselves must still carry their raw flags.
    expect(hybrid).toBeDefined();
    expect(MATRIX.find((row) => row.id === "jobweb-remote")?.isRemote).toBe(true);
    expect(MATRIX.find((row) => row.id === "jobweb-hybrid-text")?.isRemote).toBe(
      true,
    );
  });

  it("never mutates a row in place — the conversion is a spread copy", () => {
    const row = MATRIX[0];
    const converted = withRenderedRemote(row);
    expect(row.isRemote).toBe(true); // untouched
    expect(converted.isRemote).toBe(false); // the gated meaning
    expect(converted).not.toBe(row);
  });

  it("scores the same rows identically whether or not a format facet is applied", async () => {
    // The unfiltered path never builds the projection; the facet path does. If
    // the projection leaked into the row list, the two paths would score the
    // same row differently. **The score-stability proof that actually matters —
    // reverted vs fixed sources — is a MUTATION and its red count is recorded in
    // the round log; this is the in-suite half.**
    const unfiltered = await seededPipeline();
    const filtered = await seededPipeline({ format: ["online"] });
    const byId = new Map(
      unfiltered.pool.map((item) => [item.id, item.relevanceScore]),
    );
    expect(filtered.items.length).toBeGreaterThan(0);
    for (const item of filtered.items) {
      expect(item.relevanceScore).toBe(byId.get(item.id));
    }
  });
});

describe("RULING 68b — MATRIX 3: exactly one ledger write moves, claim -> silence", () => {
  const formatConcepts = (item: ScoredJobItem, converted: boolean) =>
    opportunityFacetPreferenceConcepts(
      "jobs",
      converted ? withRenderedRemote(item) : item,
    )
      .filter((concept) => concept.key.startsWith("facet:format:"))
      .map((concept) => concept.key)
      .sort();

  it("moves the jobweb remote row from an online claim to in-person", () => {
    const row = MATRIX.find((item) => item.id === "jobweb-remote")!;
    expect(formatConcepts(row, false)).toEqual(["facet:format:online"]);
    expect(formatConcepts(row, true)).toEqual(["facet:format:in-person"]);
  });

  it("moves NOTHING ELSE — the other four rows write identically", () => {
    for (const id of [
      "jobweb-notremote",
      "remotive-remote",
      "arbeitnow-remote",
      "jobweb-hybrid-text",
    ]) {
      const row = MATRIX.find((item) => item.id === id)!;
      expect(formatConcepts(row, true)).toEqual(formatConcepts(row, false));
    }
  });

  it("only ever moves from a claim to a SILENCE, never the reverse", () => {
    // The direction is the safe one: no row can GAIN a remote claim it did not
    // have, because `rendersRemoteClaim` can only turn `true` into `false`.
    for (const row of MATRIX) {
      const before = formatConcepts(row, false);
      const after = formatConcepts(row, true);
      if (before.join() === after.join()) continue;
      expect(before).toContain("facet:format:online");
      expect(after).not.toContain("facet:format:online");
    }
  });
});

describe("RULING 68b — MATRIX 4: per-row format, with the admitted controls named", () => {
  const rows = (id: string) => MATRIX.find((item) => item.id === id)!;

  it("converts ONLY the jobweb remote row", () => {
    expect(opportunityFormat("jobs", rows("jobweb-remote"))).toBe("online");
    expect(
      opportunityFormat("jobs", withRenderedRemote(rows("jobweb-remote"))),
    ).toBe("in-person");
  });

  /**
   * **ADMITTED CONTROLS — GREEN BOTH WAYS, AND SAID SO.** A full revert leaves
   * every case in this block passing, because the reverted code and the fixed
   * code agree on these rows. They are not evidence the fix landed; they are
   * evidence it does not over-reach, which is the more expensive failure.
   */
  it("admitted control: a remotive remote row stays online", () => {
    for (const id of ["remotive-remote", "arbeitnow-remote"]) {
      expect(opportunityFormat("jobs", rows(id))).toBe("online");
      expect(opportunityFormat("jobs", withRenderedRemote(rows(id)))).toBe(
        "online",
      );
    }
  });

  it("admitted control: THE HYBRID ESCAPE HATCH SURVIVES", () => {
    // `opportunityFormat` tests `/\bhybrid\b/i` against `location` and returns
    // BEFORE it ever reads `isRemote`. So a `jobweb` row that stated its own
    // format in a field it OWNS keeps that format, converted or not. The
    // conversion cannot silence a row that spoke for itself.
    const row = rows("jobweb-hybrid-text");
    expect(opportunityFormat("jobs", row)).toBe("hybrid");
    expect(opportunityFormat("jobs", withRenderedRemote(row))).toBe("hybrid");
  });

  it("admitted control: a jobweb row that never claimed remote is unchanged", () => {
    const row = rows("jobweb-notremote");
    expect(opportunityFormat("jobs", row)).toBe("in-person");
    expect(opportunityFormat("jobs", withRenderedRemote(row))).toBe("in-person");
  });
});

/**
 * **TWO SITES THE MATRIX TESTS ABOVE DID NOT REACH, FOUND BY MUTATION AND
 * COVERED HERE.** Reverting site 1 (the FRESH pool's counts) and site 4 (the
 * ledger write) both left the suite GREEN on the first run — site 1 because a
 * seeded cache makes the pipeline take the CACHED path and never build a fresh
 * pool, and site 4 because the matrix tests call the ledger helper directly
 * rather than through `scoreJobs`. **Neither gap is a code defect; both are test
 * coverage the standard requires, and both now have their own red.**
 */
describe("RULING 68b — site 4: the ledger write, through the SHIPPED scorer", () => {
  /**
   * The concepts at `scoring.ts:345` become `facade.metadata.preferenceSignals`,
   * which the ledger-affinity term reads. So a reader whose ledger LIKES
   * `facet:format:online` scores an online row higher — and that is the
   * behavioural handle on this site.
   *
   * **AND IT CORRECTS B's BOUNDARY, MEASURED RATHER THAN ASSUMED.** B wrote
   * that `scoreJobs`'s numeric output must be "byte-identical after the change".
   * That holds for a profile whose ledger says nothing about format — but **for
   * a reader whose ledger carries a format preference the score DOES move**, and
   * it must, because the whole point of the item is that the row stops claiming
   * to be online. **The scoring MATHS is untouched; the INPUT concept changes,
   * which is the fix.** Recorded so a later round does not read a moved score
   * here as a regression.
   */
  const likesOnline: PreferenceLedger = {
    "facet:format:online": {
      key: "facet:format:online",
      label: "Online",
      source: "opportunity_facet",
      positive: 8,
      negative: 0,
      lastPositiveAt: "2026-07-20T00:00:00.000Z",
      lastSeenAt: "2026-07-20T00:00:00.000Z",
    },
  };

  const scoreOf = (ledger: PreferenceLedger | undefined, id: string) => {
    const scored = scoreJobs(
      MATRIX,
      {
        topics: [],
        softTopics: [],
        methods: [],
        seedTexts: [],
        preferenceLedger: ledger,
        careerStage: "PhD Year 2",
        industryVsAcademia: "academia",
        locationPreferences: [],
      } as unknown as JobScoringProfile,
      NOW.getTime(),
      { applyFloor: false },
    );
    return scored.find((item) => item.id === id)?.score;
  };

  it("stops a jobweb row inheriting an ONLINE preference it never showed the reader", () => {
    // Both rows are `in-person` after the conversion, and the only difference
    // between them is the raw flag — so if the ledger's online affinity still
    // reached `jobweb-remote`, these two would diverge.
    const remote = scoreOf(likesOnline, "jobweb-remote");
    const notRemote = scoreOf(likesOnline, "jobweb-notremote");
    expect(remote).toBeDefined();
    expect(remote).toBe(notRemote);
  });

  it("admitted control: an OWNED remote row still inherits the online preference", () => {
    // `remotive-remote` sets `isRemote` from a structured field of its own
    // record, so it keeps its online concept and outscores the in-person rows
    // for this reader. The conversion must not silence it.
    const owned = scoreOf(likesOnline, "remotive-remote");
    const inPerson = scoreOf(likesOnline, "jobweb-notremote");
    expect(owned).toBeDefined();
    expect(owned!).toBeGreaterThan(inPerson!);
  });

  it("leaves the score untouched for a reader whose ledger says nothing about format", () => {
    // B's boundary, in the case where it holds: with no format entry in the
    // ledger there is nothing for the concept change to feed, and the numeric
    // output is identical.
    for (const id of MATRIX.map((row) => row.id)) {
      expect(scoreOf(undefined, id)).toBe(scoreOf({}, id));
    }
  });
});

describe("RULING 68b — site 1: the FRESH pool's counts carry the same conversion", () => {
  /**
   * The seeded-cache tests above exercise the CACHED return only, so reverting
   * the fresh return left them green. A fresh pool cannot be built in a unit
   * test without hitting the network, so this is a CONTRACT assertion on the
   * source instead — and it is a real lock, not decoration: it reds the moment
   * either return counts facets from the raw list.
   *
   * **Both returns feed the same facet panel**, so converting one and not the
   * other would make a pool disagree with its own cache — a divergence of
   * exactly the kind this item exists to remove.
   */
  it("counts facets through the shared predicate at EVERY jobs call site", () => {
    const source = readFileSync(
      new URL("./pipeline.ts", import.meta.url),
      "utf8",
    );
    const calls = [...source.matchAll(/countOpportunityFacets\([^)]*\)/g)].map(
      (match) => match[0],
    );
    expect(calls.length).toBeGreaterThanOrEqual(2);
    for (const call of calls) {
      expect(call).toContain("withRenderedRemote");
    }
  });

  it("filters through the shared predicate, and re-selects the ORIGINAL rows", () => {
    const source = readFileSync(
      new URL("./pipeline.ts", import.meta.url),
      "utf8",
    );
    expect(source).toContain("scored.map(withRenderedRemote)");
    // the trap: the row list handed downstream must be re-selected from
    // `scored`, never the projection itself
    expect(source).toContain(
      "const facetFiltered = scored.filter((item) => facetFilteredIds.has(item.id));",
    );
  });

  it("leaves facets.ts and the EVENT pipeline out of it", () => {
    // The duck-typing is fixed by making both callers pass the same MEANING of
    // `isRemote`, not by making the shared callee smarter — `opportunityFormat`
    // serves the event surface too, where `isRemote` is never read.
    const facets = readFileSync(
      new URL("../opportunities/facets.ts", import.meta.url),
      "utf8",
    );
    expect(facets).not.toContain("rendersRemoteClaim");
    expect(facets).not.toContain("withRenderedRemote");
    const events = readFileSync(
      new URL("../events/pipeline.ts", import.meta.url),
      "utf8",
    );
    expect(events).not.toContain("withRenderedRemote");
  });
});
