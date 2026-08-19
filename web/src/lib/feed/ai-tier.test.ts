import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultProfile, type UserProfile } from "@/types";
import { opportunityRequestBody } from "@/store/feed";
import {
  aiModeChip,
  feedsUseAi,
  hasLocalDeveloperProvider,
  hasUserLlmOverride,
} from "./ai-tier";

/**
 * RULING 66a / 68a (round 25 C, item 2). **THE CHIP'S PREDICATE, IN BOTH
 * STATES, PLUS THE IDENTITY THAT MAKES THE FIX HOLD.**
 *
 * The defect was never detection or pinning: the dashboard chip rendered from
 * `aiPaperSearchEnabled && canUseAiTools`, and `aiPaperSearchEnabled` is a
 * PAPERS toggle that the job/event request builder never reads. So the chip
 * said `Tier 0` — and its tooltip said "no AI API" — while the feeds sent
 * `aiTier: 2`. Round 25 B proved the pipelines were already running the model
 * on localhost.
 *
 * The fix is that both sides now call the SAME function. **The load-bearing
 * assertion in this file is the last one: the chip's boolean and the request
 * builder's `aiTier` are computed from one predicate and cannot drift again.**
 */

const BYOK: UserProfile = {
  ...defaultProfile,
  feedAiProvider: "openai",
  feedAiApiKey: "  not-a-real-key  ",
};
const LOCAL: UserProfile = {
  ...defaultProfile,
  feedAiProvider: "default",
  feedAiApiKey: "",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("feedsUseAi — the predicate the chip's tier text renders from", () => {
  it("is TRUE for a developer running locally against the machine's own provider", () => {
    // THE USER'S OWN STATE, and the one the chip got wrong: `feedAiProvider`
    // is `default` and no user key is set, yet the feeds ask for tier 2.
    vi.stubEnv("NODE_ENV", "development");
    expect(feedsUseAi(LOCAL)).toBe(true);
    expect(hasLocalDeveloperProvider(LOCAL)).toBe(true);
    // and no override may be sent on this path — that is what keeps the key
    // on the server.
    expect(hasUserLlmOverride(LOCAL)).toBe(false);
  });

  it("is TRUE when the reader brought their own provider and key", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(feedsUseAi(BYOK)).toBe(true);
    expect(hasUserLlmOverride(BYOK)).toBe(true);
  });

  it("is FALSE for a deployed reader with no key — deployed-user safety, unchanged", () => {
    // **THE RECORDED DECISION THIS FIX MAY NOT WIDEN.** A deployed user must
    // never get an operator-funded fallback. `canUseLocalServerProvider` and
    // the provider registry are untouched by Ruling 68a; this is the assertion
    // that catches a later change trying to widen the local branch past
    // development.
    vi.stubEnv("NODE_ENV", "production");
    expect(feedsUseAi(LOCAL)).toBe(false);
    expect(hasLocalDeveloperProvider(LOCAL)).toBe(false);
  });

  it("is FALSE when a provider is chosen but the key is blank or whitespace", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(feedsUseAi({ ...BYOK, feedAiApiKey: "   " })).toBe(false);
    expect(feedsUseAi({ ...BYOK, feedAiApiKey: undefined })).toBe(false);
  });
});

describe("aiModeChip — what the mode chip actually says", () => {
  it("reads Tier 2 with the papers toggle OFF — THE BUG, STATED AS A CONTRACT", () => {
    // **THIS IS THE USER'S REPORT, TURNED INTO AN ASSERTION.** Papers toggle
    // off, provider reachable: the chip used to read `Tier 0` and its tooltip
    // used to say "no AI API", while the job and event feeds sent `aiTier: 2`.
    const chip = aiModeChip({ feedsUseAi: true, aiSearchActive: false });
    expect(chip.tier).toBe("Tier 2");
    expect(chip.title).not.toContain("no AI API");
    expect(chip.title).toContain("Job and event search already use AI");
    // The LABEL still reports this button's own pressed state — that half was
    // never wrong, and changing it would be a different lie.
    expect(chip.label).toBe("Auto");
  });

  it("reads Tier 2 with the papers toggle ON", () => {
    const chip = aiModeChip({ feedsUseAi: true, aiSearchActive: true });
    expect(chip.tier).toBe("Tier 2");
    expect(chip.label).toBe("AI search");
    expect(chip.title).toContain("job and event search use AI too");
  });

  it("reads Tier 0 and keeps today's wording when no provider is reachable", () => {
    // THE UNCHANGED STATE. A reader with no key sees exactly what they saw
    // before Ruling 68a, which is what makes this a truth-telling fix rather
    // than a new claim.
    const chip = aiModeChip({ feedsUseAi: false, aiSearchActive: false });
    expect(chip.tier).toBe("Tier 0");
    expect(chip.label).toBe("Auto");
    expect(chip.title).toBe("Add your own AI key to enable AI search.");
  });

  it("never lets the papers toggle move the tier text", () => {
    // The predicate the chip's tier reads must be independent of the papers
    // toggle in BOTH directions. This is the assertion that goes red if a
    // later change points `tier` back at `aiSearchActive`.
    for (const feeds of [true, false]) {
      const on = aiModeChip({ feedsUseAi: feeds, aiSearchActive: true });
      const off = aiModeChip({ feedsUseAi: feeds, aiSearchActive: false });
      expect(`${feeds}: ${on.tier} / ${off.tier}`).toBe(
        `${feeds}: ${on.tier} / ${on.tier}`,
      );
    }
  });
});

describe("the chip and the feeds cannot disagree again", () => {
  it("computes the chip's boolean and both feeds' aiTier from one predicate", () => {
    // **THIS IS THE ANTI-DRIFT LOCK.** It fails the moment either side starts
    // deriving the tier from anything else — including the papers toggle,
    // which is what it derived from before Ruling 68a.
    for (const env of ["development", "production"] as const) {
      for (const [label, profile] of [
        ["local-dev", LOCAL],
        ["byok", BYOK],
      ] as const) {
        vi.stubEnv("NODE_ENV", env);
        const expected = feedsUseAi(profile) ? 2 : 0;
        for (const surface of ["jobs", "events"] as const) {
          const body = opportunityRequestBody(profile, surface, []);
          expect(`${env}/${label}/${surface} -> ${body.aiTier}`).toBe(
            `${env}/${label}/${surface} -> ${expected}`,
          );
        }
      }
    }
  });

  it("still sends an override only on the bring-your-own-key path", () => {
    vi.stubEnv("NODE_ENV", "development");
    // Local developer: tier 2, but NO override leaves the client.
    const local = opportunityRequestBody(LOCAL, "jobs", []);
    expect(local.aiTier).toBe(2);
    expect(local.llmOverride).toBeUndefined();
    // BYOK: tier 2 and the reader's own override.
    const byok = opportunityRequestBody(BYOK, "jobs", []);
    expect(byok.aiTier).toBe(2);
    expect(byok.llmOverride).toEqual({
      provider: "openai",
      apiKey: "not-a-real-key",
    });
  });
});
