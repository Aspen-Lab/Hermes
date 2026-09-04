import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * ABC-freemium 1-10 / 1-12 · R-GUARD-1, R-GUARD-2, R-TEST-1.
 *
 * The prebuild guard is the last thing between a misconfigured Vercel project
 * and a silently wrong deployment, and it **had no test at all** — it was
 * referenced only by `package.json`'s `prebuild`.
 *
 * **It is tested by spawning it, not by importing it.** Its whole contract is an
 * exit code and a message on stderr, and the module's top-level body calls
 * `process.exit(1)`; importing it would either kill the test process or test
 * something that is not what `prebuild` runs.
 *
 * **This file lives under `src/` on purpose.** Vitest's `include` is
 * `src/**​/*.test.{ts,tsx}` — a test placed next to the script under `scripts/`
 * would never run, and the requirement would be green by absence.
 */

const SCRIPT = path.join(
  process.cwd(),
  "scripts",
  "assert-byok-production-env.mjs",
);

/** A recognisable value that must never be echoed back (R-GUARD-2). */
const SENTINEL = "SENTINEL-NOT-A-KEY-9f3a";

const ALL_REQUIRED = {
  GOOGLE_API_KEY: "REQUIRED-NOT-A-KEY",
  TAVILY_API_KEY: "REQUIRED-NOT-A-KEY",
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "REQUIRED-NOT-A-KEY",
};

const FORBIDDEN_NAMES = [
  "PEER_DIGEST_PROVIDER",
  "GOOGLE_VERTEX_PROJECT",
  "GOOGLE_VERTEX_SEARCH_PROJECT",
  "GOOGLE_VERTEX_SEARCH_ENGINE_ID",
  "GOOGLE_VERTEX_SEARCH_DATA_STORE_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "QWEN_API_KEY",
  "DASHSCOPE_API_KEY",
  "DEEPSEEK_API_KEY",
  "BRAVE_SEARCH_API_KEY",
  "PEER_DEV_ENTITLEMENT",
] as const;

/**
 * Run the guard with a **controlled** environment. Only the few variables Node
 * itself needs are carried over, so the developer's own `.env` or shell cannot
 * make a case pass or fail by accident — and no real credential is ever handed
 * to the child.
 */
function runGuard(env: Record<string, string>): {
  status: number | null;
  output: string;
} {
  const result = spawnSync(process.execPath, [SCRIPT], {
    // Cast because Next's ambient typing makes `NODE_ENV` required on
    // `ProcessEnv`, and deliberately NOT passing it is the point: the child
    // must see only what a case sets.
    env: {
      PATH: process.env.PATH ?? "",
      SystemRoot: process.env.SystemRoot ?? "",
      PATHEXT: process.env.PATHEXT ?? "",
      COMSPEC: process.env.COMSPEC ?? "",
      ...env,
    } as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
  return {
    status: result.status,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
}

describe("assert-byok-production-env", () => {
  it("passes a correctly configured Vercel build", () => {
    const { status } = runGuard({ VERCEL: "1", ...ALL_REQUIRED });
    expect(status).toBe(0);
  });

  it("does nothing at all off Vercel, whatever the environment holds", () => {
    // A developer building locally has every one of these set and must not be
    // blocked. This is why `isVercelBuild` guards the whole body.
    const { status } = runGuard({
      GOOGLE_VERTEX_PROJECT: "local-project",
      PEER_DIGEST_PROVIDER: "gemini",
      PEER_DEV_ENTITLEMENT: "paid",
      PEER_FEED_AI_TIER: "2",
    });
    expect(status).toBe(0);
  });

  describe("required settings (R-GUARD-1)", () => {
    for (const name of Object.keys(ALL_REQUIRED)) {
      it(`fails the build when ${name} is missing, and names it`, () => {
        const env: Record<string, string> = { VERCEL: "1", ...ALL_REQUIRED };
        delete env[name];

        const { status, output } = runGuard(env);

        expect(status).toBe(1);
        expect(output).toContain(name);
      });
    }

    it("names EVERY missing variable, not just the first", () => {
      // A build that fails four times in a row, each naming one more variable,
      // is four wasted deploys.
      const { output } = runGuard({ VERCEL: "1" });
      for (const name of Object.keys(ALL_REQUIRED)) {
        expect(output).toContain(name);
      }
    });
  });

  describe("forbidden settings (R-GUARD-1)", () => {
    for (const name of FORBIDDEN_NAMES) {
      it(`fails the build when ${name} is set, and names it`, () => {
        const { status, output } = runGuard({
          VERCEL: "1",
          ...ALL_REQUIRED,
          [name]: SENTINEL,
        });

        expect(status).toBe(1);
        expect(output).toContain(name);
      });
    }

    it("fails the build when PEER_FEED_AI_TIER is forced above 0", () => {
      const { status, output } = runGuard({
        VERCEL: "1",
        ...ALL_REQUIRED,
        PEER_FEED_AI_TIER: "2",
      });

      expect(status).toBe(1);
      expect(output).toContain("PEER_FEED_AI_TIER");
    });

    it("no longer bans GOOGLE_API_KEY — D1 makes it required", () => {
      // This is the assertion that would have caught the old guard: it banned
      // the very key the product now runs on, so the first deploy after R-KEY-1
      // would have exited 1.
      const { status } = runGuard({ VERCEL: "1", ...ALL_REQUIRED });
      expect(status).toBe(0);
    });
  });

  it("never prints a VALUE (R-GUARD-2)", () => {
    // The message may name variables. The obvious way to write the "missing"
    // half is `Missing: NAME=${env[NAME]}`, which prints an empty string today
    // and a live key the day someone sets a wrong-cased variant.
    const { status, output } = runGuard({
      VERCEL: "1",
      ...ALL_REQUIRED,
      GOOGLE_VERTEX_PROJECT: SENTINEL,
      ANTHROPIC_API_KEY: SENTINEL,
    });

    expect(status).toBe(1);
    expect(output).toContain("GOOGLE_VERTEX_PROJECT");
    expect(output).not.toContain(SENTINEL);
  });
});
