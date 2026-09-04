import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultProfile, type UserProfile } from "@/types";
import { opportunityRequestBody, paperFeedRequestBody } from "@/store/feed";
import {
  ANONYMOUS_ENTITLEMENT,
  type Entitlement,
} from "@/lib/entitlement/types";
import {
  aiAvailability,
  aiModeChip,
  feedsUseAi,
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
const NO_KEY: UserProfile = {
  ...defaultProfile,
  feedAiProvider: "default",
  feedAiApiKey: "",
};

/**
 * ABC-freemium 1-14 / 1-16 — the two entitlements that matter here. D1 gives
 * Peer's model to **every signed-in user**, so `plan` is deliberately `free`:
 * if a later change tightens the predicate to `effectivePlan`, these tests go
 * red.
 */
const SIGNED_IN: Entitlement = {
  ...ANONYMOUS_ENTITLEMENT,
  userId: "user-1",
  deepReportsRemaining: 5,
};
const SIGNED_OUT: Entitlement = ANONYMOUS_ENTITLEMENT;

const ADVISOR_SEEDS = { seedTexts: [], seedWorkIds: [] };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("aiAvailability — the ONE predicate", () => {
  // ABC-freemium 1-14 · R-ENT-3 — REWRITTEN, NOT DELETED. Every case below used
  // to turn on `process.env.NODE_ENV === "development"`, which Next inlines into
  // the browser bundle: the client decided whether AI was available by asking
  // how it had been built. The dev override moved server-side to
  // `PEER_DEV_ENTITLEMENT` (R-ENT-5), so the runtime no longer appears here at
  // all — and the pair of assertions below is what proves it cannot come back.
  it("is the SAME in development and in production", () => {
    // The single assertion that would have caught all six deleted flags.
    for (const env of ["development", "production"] as const) {
      vi.stubEnv("NODE_ENV", env);
      expect(aiAvailability(NO_KEY, SIGNED_IN)).toBe("system");
      expect(aiAvailability(NO_KEY, SIGNED_OUT)).toBe("none");
      expect(aiAvailability(BYOK, SIGNED_IN)).toBe("byok");
      expect(aiAvailability(BYOK, SIGNED_OUT)).toBe("byok");
    }
  });

  it("gives a signed-in FREE user Peer's model (D1)", () => {
    // The ceiling is `userId !== null`, never `effectivePlan`. A later round
    // will be tempted to tighten this to `paid`; that would break D1.
    expect(SIGNED_IN.effectivePlan).toBe("free");
    expect(aiAvailability(NO_KEY, SIGNED_IN)).toBe("system");
    expect(feedsUseAi(NO_KEY, SIGNED_IN)).toBe(true);
  });

  it("gives a signed-out reader nothing", () => {
    expect(aiAvailability(NO_KEY, SIGNED_OUT)).toBe("none");
    expect(feedsUseAi(NO_KEY, SIGNED_OUT)).toBe(false);
  });

  it("keeps a BYOK reader on their own key even when entitled", () => {
    // The three cache keys of R-UI-4 depend on this staying distinct from
    // "system": a BYOK report and a Peer-AI report must not share an entry.
    expect(aiAvailability(BYOK, SIGNED_IN)).toBe("byok");
    expect(hasUserLlmOverride(BYOK)).toBe(true);
    expect(hasUserLlmOverride(NO_KEY)).toBe(false);
  });

  it("is not BYOK when a provider is chosen but the key is blank", () => {
    expect(aiAvailability({ ...BYOK, feedAiApiKey: "   " }, SIGNED_OUT)).toBe(
      "none",
    );
    expect(
      aiAvailability({ ...BYOK, feedAiApiKey: undefined }, SIGNED_IN),
    ).toBe("system");
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
  it("computes the chip's boolean and ALL THREE request builders' aiTier from one predicate", () => {
    // **THE ANTI-DRIFT LOCK, EXTENDED.** It used to cover the jobs and events
    // builders only, and the papers builder was the one that drifted: round-1 B
    // found `store/feed.ts` re-implementing both halves inline, with a local
    // `hasUserLlmOverride` that SHADOWED the imported function of the same name.
    // Adding `paperFeedRequestBody` here is what would have caught it.
    //
    // The environment loop stays, and now proves the opposite of what it used
    // to: the answer must be the same in both runtimes, because no client code
    // may decide AI availability from `NODE_ENV` any more (R-ENT-3 as amended).
    for (const env of ["development", "production"] as const) {
      for (const [label, profile] of [
        ["no-key", NO_KEY],
        ["byok", BYOK],
      ] as const) {
        for (const [who, entitlement] of [
          ["signed-in", SIGNED_IN],
          ["signed-out", SIGNED_OUT],
        ] as const) {
          vi.stubEnv("NODE_ENV", env);
          const expected = feedsUseAi(profile, entitlement) ? 2 : 0;
          const where = `${env}/${label}/${who}`;

          for (const surface of ["jobs", "events"] as const) {
            const body = opportunityRequestBody(profile, surface, [], entitlement);
            expect(`${where}/${surface} -> ${body.aiTier}`).toBe(
              `${where}/${surface} -> ${expected}`,
            );
          }

          // The papers builder ANDs its own surface toggle on top, so it is
          // compared with that toggle ON — the question is whether the
          // underlying predicate is the same one, not whether the toggle works.
          const papers = paperFeedRequestBody(
            profile,
            ADVISOR_SEEDS,
            true,
            [],
            entitlement,
          );
          expect(`${where}/papers -> ${papers.aiTier}`).toBe(
            `${where}/papers -> ${expected}`,
          );
        }
      }
    }
  });

  it("keeps the papers toggle able to turn papers OFF without moving the others", () => {
    // The toggle is a real, separate choice about one surface. Collapsing the
    // predicates must not collapse that too.
    const papers = paperFeedRequestBody(
      NO_KEY,
      ADVISOR_SEEDS,
      false,
      [],
      SIGNED_IN,
    );
    expect(papers.aiTier).toBe(0);
    expect(opportunityRequestBody(NO_KEY, "jobs", [], SIGNED_IN).aiTier).toBe(2);
  });

  it("still sends an override only on the bring-your-own-key path", () => {
    // A signed-in reader on Peer's model: tier 2, but NO key leaves the client.
    const system = opportunityRequestBody(NO_KEY, "jobs", [], SIGNED_IN);
    expect(system.aiTier).toBe(2);
    expect(system.llmOverride).toBeUndefined();
    // BYOK: tier 2 and the reader's own override.
    const byok = opportunityRequestBody(BYOK, "jobs", [], SIGNED_IN);
    expect(byok.aiTier).toBe(2);
    expect(byok.llmOverride).toEqual({
      provider: "openai",
      apiKey: "not-a-real-key",
    });
  });
});
