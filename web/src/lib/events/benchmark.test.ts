import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PreferenceLedger } from "@/types";
import { buildDailyEventPool } from "./pipeline";
import { scoredEventToEvent } from "./mapper";
import { MIN_SCORE } from "./scoring";
import type { EventsFeedRequest } from "./types";
import { DENY_HOSTS } from "./sources/eventweb";

interface ProfileSnapshot {
  researchTopics?: string[];
  softTopics?: string[];
  preferredMethods?: string[];
  advisorSeedTexts?: string[];
  preferenceLedger?: PreferenceLedger;
  careerStage?: EventsFeedRequest["careerStage"];
  industryVsAcademia?: EventsFeedRequest["industryVsAcademia"];
  locationPreferences?: string[];
  currentProject?: string;
  tavilyEnabled?: boolean;
  tavilyApiKey?: string;
}

const defaultProfilePath = path.join(
  process.cwd(),
  ".local-data",
  "profile.json",
);
// An override lets an isolated git worktree validate the real local snapshot
// without copying a secret into a path that may not yet be gitignored.
const profilePath =
  process.env.PEER_PROFILE_SNAPSHOT_PATH ?? defaultProfilePath;
const profile = fs.existsSync(profilePath)
  ? (JSON.parse(fs.readFileSync(profilePath, "utf8")) as ProfileSnapshot)
  : undefined;
const hasLiveKey = Boolean(profile?.tavilyApiKey?.trim());

function hostname(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.toLocaleLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isDeniedHost(host: string): boolean {
  return DENY_HOSTS.some(
    (denied) => host === denied || host.endsWith(`.${denied}`),
  );
}

/**
 * A23-03 / RULING 62a / RULING 63b — THE ADJUDICATED PLACE ROWS.
 * (Round 24 C, item 3. These two lists are what replaced the coverage floor;
 * the restatement itself is commented at the assertion site below.)
 *
 * Ruling 62a's four named CONTAMINATION hosts. Each of these pages mentions a
 * city exactly ONCE, in text that is not a venue statement, and the place guard
 * correctly renders NOTHING. **Silence is the CORRECT VALUE for these rows**,
 * and it is asserted as a value rather than tolerated as an absence.
 */
const CONTAMINATION_HOSTS = [
  "flogen.org",
  "storageusa.solarenergyevents.com",
  "nanoge.org",
  "sdle.co.il",
] as const;

/**
 * The VENUE-ANCHORED hosts and the city each one must render. Ground truth from
 * round 24 A's live census, where the same city token appears 6–22 times in the
 * page: `Aachen` ×22, `Jakarta` ×22, `Detroit` ×17, `Orlando` ×8, `San Diego` ×6
 * (and in that page's own title). **This wires up Ruling 62a's OWN FALSIFIER —
 * "any correct, current venue lost" — which no assertion in this file covered.**
 *
 * SIX, NOT FIVE, AND C SAYS WHY: round 24 B's design named
 * `thebatteryshowsouth.com` and C's brief named `battery-power.eu`. Both are
 * separately adjudicated correct-and-kept rows, so C locks the UNION rather
 * than choosing. An absent row is skipped, so the extra entry costs nothing and
 * loses no adjudicated ground.
 *
 * MAINTENANCE RULE, stated up front because without it this rots into a
 * nuisance inside three rounds: a conference legitimately moves city between
 * editions. When a named row's correct venue genuinely CHANGES, the expected
 * value is RESTATED here with the round and the reason named — **never deleted,
 * never loosened to "any city"**. That is Ruling 61c's own rule applied to the
 * artefact it created.
 */
const VENUE_ANCHORED_CITY: ReadonlyArray<readonly [string, string]> = [
  ["battery-power.eu", "Aachen"],
  ["ibatterysummit.com", "Jakarta"],
  ["thebatteryshow.com", "Detroit"],
  ["thebatteryshowsouth.com", "Atlanta"],
  ["internationalbatteryseminar.com", "Orlando"],
  ["advancedautobat.com", "San Diego"],
];

describe.skipIf(!hasLiveKey)("events live relevance benchmark", () => {
  it(
    "enriches at least half the pool and resolves the Solid-State Battery Summit",
    async () => {
      const pool = await buildDailyEventPool({
        topics: profile?.researchTopics ?? [],
        softTopics: profile?.softTopics ?? [],
        methods: profile?.preferredMethods ?? [],
        seedTexts: profile?.advisorSeedTexts ?? [],
        preferenceLedger: profile?.preferenceLedger,
        careerStage: profile?.careerStage,
        industryVsAcademia: profile?.industryVsAcademia,
        locationPreferences: profile?.locationPreferences ?? [],
        currentProject: profile?.currentProject,
        topN: 5,
        aiTier: 0,
        searchConnectors: {
          tavily: {
            enabled: profile?.tavilyEnabled !== false,
            apiKey: profile?.tavilyApiKey,
          },
        },
      });
      const survivors = pool.items;
      const topFive = survivors
        .filter((item) => item.score >= MIN_SCORE)
        .slice(0, 5)
        .map((item) => scoredEventToEvent(item));
      const withCity = survivors.filter((item) => item.place?.city);
      const cityCoverage =
        survivors.length > 0 ? withCity.length / survivors.length : 0;

      console.info(
        "EVENT_BENCHMARK_TOP5",
        topFive.map((item) => ({
          name: item.name,
          host: hostname(item.linkOfficial),
          city: item.place?.city,
          date: item.date,
        })),
      );
      console.info("EVENT_BENCHMARK_CITY_COVERAGE", {
        withCity: withCity.length,
        survivors: survivors.length,
        ratio: cityCoverage,
      });

      expect(survivors.length).toBeGreaterThan(0);

      // ══════════════════════════════════════════════════════════════════════
      // RULING 63b's COMMISSIONED RESTATEMENT (round 24 C, item 3).
      // This replaces `expect(cityCoverage).toBeGreaterThanOrEqual(0.5)`.
      // THE LINE IS RESTATED, NOT DELETED — the ratio is still computed and
      // still console.info-ed above as an observability metric; it is simply no
      // longer ASSERTED.
      //
      // WHY: 63b's diagnosis is that this floor and Ruling 62a's place design
      // pull in OPPOSITE directions, and the design is winning. The guard
      // silences a city that is merely MENTIONED, so the better it works the
      // LOWER this ratio goes — 0.4375 in round 23, then 0.333 and 0.286 in
      // round 24, moving AWAY from the floor for the right reason. A red that
      // only means "the guard did its job" carries no information, and Ruling
      // 32 names "this field must not be empty" as the defect itself.
      //
      // **THERE IS DELIBERATELY NO LOWER BOUND ON `withCity`, AND A POOL WITH
      // ZERO CITIES IS A PASS.** That absence is commented here rather than
      // merely left out.
      //
      // WHAT REPLACES IT is a NAMED-ROW VALUE LOCK — the shape this loop has
      // already shipped twice (62c's `careerservices.upenn.edu` admitted
      // control and the SolarPACES regression lock). It measures the VALUE of
      // `place.city` on rows already adjudicated, not how many rows have one.
      //
      // Two candidate quality floors were built and KILLED as provably vacuous
      // before this design was chosen (round 24 B): "a rendered city must not
      // sit on an online-only row" is false by construction, since a row with a
      // city HAS a physical place; and "a rendered city must appear in the row's
      // own location string" is tautological, since `location` is COMPOSED from
      // `place`. There is no non-vacuous LIVE oracle for "venue-anchored" —
      // deciding it requires knowing where the event is, which is the thing
      // being extracted. That property is PROVEN deterministically instead, by
      // the ablation fixtures in
      // `src/lib/opportunities/structured-extract.test.ts`. This benchmark's
      // job is the half only it can do: catching the shipped pipeline
      // REGRESSING on rows we have already adjudicated.
      //
      // LIVE-SAFETY: every named row is SKIPPED when it is not in the pool.
      // Assert on rows PRESENT; never demand presence.
      // ══════════════════════════════════════════════════════════════════════
      let namedRowsExercised = 0;
      for (const host of CONTAMINATION_HOSTS) {
        for (const item of survivors.filter((row) =>
          hostname(row.url).endsWith(host),
        )) {
          namedRowsExercised += 1;
          // The host is prefixed into both sides so a failure names the row.
          expect(`${host} -> ${item.place?.city ?? "(silent)"}`).toBe(
            `${host} -> (silent)`,
          );
        }
      }
      for (const [host, city] of VENUE_ANCHORED_CITY) {
        for (const item of survivors.filter((row) =>
          hostname(row.url).endsWith(host),
        )) {
          namedRowsExercised += 1;
          expect(`${host} -> ${item.place?.city ?? "(silent)"}`).toBe(
            `${host} -> ${city}`,
          );
        }
      }
      // THE LOCK IS ALIVE. This is a floor on TEST EXERCISE, not on FIELD
      // VALUES — it creates no pressure to render a city anywhere, and fails
      // only when this benchmark has quietly stopped testing anything at all.
      // Measured at 5 named rows per pull across round 24 B's five pulls, so a
      // floor of 1 has four rows of headroom. That distinction is why it is not
      // the shape Ruling 32 forbids.
      expect(namedRowsExercised).toBeGreaterThan(0);

      expect(
        topFive.some(
          (item) =>
            hostname(item.linkOfficial).endsWith("cambridgeenertech.com") ||
            /solid[-\s]?state battery summit/i.test(item.name),
        ),
      ).toBe(true);
      // ══════════════════════════════════════════════════════════════════════
      // RULING 64c (round 24 C, item 3). THE `Chicago` HARD-ASSERT, RESTATED,
      // NOT DELETED. It read:
      //
      //   const summit =
      //     survivors.find((item) => hostname(item.url).endsWith("cambridgeenertech.com"))
      //     ?? survivors.find((item) =>
      //          /solid[-\s]?state battery summit/i.test(item.name)
      //          && item.place?.city === "Chicago");
      //   expect(summit?.place?.city).toBe("Chicago");
      //
      // **IT ASSERTED THE OLD WORLD TWICE OVER**, and it is the same structural
      // fault Ruling 63b named one assertion above: it demands that a specific
      // city be PRESENT, and it was satisfied by values this round's design
      // removes on purpose.
      //  - Its FIRST arm was satisfied by `cambridgeenertech.com/cet/conferences`
      //    — the conference INDEX page A24-01 now drops by KIND.
      //  - Its FALLBACK demanded a `solid-state battery summit` row already
      //    carrying `Chicago`, and Ruling 62a's place guard rightly SILENCES
      //    that row's city (measured 5 of 5). `Chicago` appeared 4 times in a
      //    29 kB index page — between the guard's live classes (silenced at 1,
      //    kept at 6–22) and NOT a venue statement.
      // So `summit` becomes `undefined` and `expect(undefined).toBe("Chicago")`
      // would fail for the two best possible reasons.
      //
      // THE NEW CONTRACT: **no row anywhere is required to prove a city.** If
      // this host is in the pool at all, its row must be one of the host's
      // DATED EVENT PAGES rather than the index, and it must not be named after
      // a provider-attribution phrase. Absent host, no assertion — same
      // live-safety rule as the value lock above.
      // ══════════════════════════════════════════════════════════════════════
      for (const item of survivors.filter((row) =>
        hostname(row.url).endsWith("cambridgeenertech.com"),
      )) {
        expect(`${item.url} (index page readmitted?)`).not.toMatch(
          /\/cet\/conferences\/?(?:[?#].*)?$/,
        );
        expect(item.name).not.toMatch(
          /^\s*(?:provided|presented|organised|organized|hosted)\s+by\b/i,
        );
      }
      for (const item of topFive) {
        expect(isDeniedHost(hostname(item.linkOfficial))).toBe(false);
      }
    },
    90_000,
  );
});
