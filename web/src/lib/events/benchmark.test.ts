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
      expect(cityCoverage).toBeGreaterThanOrEqual(0.5);
      expect(
        topFive.some(
          (item) =>
            hostname(item.linkOfficial).endsWith("cambridgeenertech.com") ||
            /solid[-\s]?state battery summit/i.test(item.name),
        ),
      ).toBe(true);
      const summit =
        survivors.find((item) =>
          hostname(item.url).endsWith("cambridgeenertech.com"),
        ) ??
        survivors.find(
          (item) =>
            /solid[-\s]?state battery summit/i.test(item.name) &&
            item.place?.city === "Chicago",
        );
      expect(summit?.place?.city).toBe("Chicago");
      for (const item of topFive) {
        expect(isDeniedHost(hostname(item.linkOfficial))).toBe(false);
      }
    },
    90_000,
  );
});
