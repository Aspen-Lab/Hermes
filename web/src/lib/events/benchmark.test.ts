import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { PreferenceLedger } from "@/types";
import { runEventsPipeline } from "./pipeline";
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
    "surfaces the Solid-State Battery Summit without denied hosts",
    async () => {
      const response = await runEventsPipeline({
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

      console.info(
        "EVENT_BENCHMARK_TOP5",
        response.items.map((item) => ({
          name: item.name,
          host: hostname(item.linkOfficial),
        })),
      );

      expect(
        response.items.some(
          (item) =>
            hostname(item.linkOfficial).endsWith("cambridgeenertech.com") ||
            /solid[-\s]?state battery summit/i.test(item.name),
        ),
      ).toBe(true);
      for (const item of response.items) {
        expect(isDeniedHost(hostname(item.linkOfficial))).toBe(false);
      }
    },
    30_000,
  );
});
