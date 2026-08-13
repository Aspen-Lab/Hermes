import { afterEach, describe, expect, it, vi } from "vitest";
import { getDevTestUserId, verifyDevSlug } from "./dev-auth";

// Every value here is an obviously-fake, test-only fixture -- never a real
// slug or a real Supabase user id. See docs/handoff/MULTIAGENT-mcp-app.md
// §1c (RULING 2): the real values live only in the gitignored
// web/.env.local and must never appear in a commit, log, or fixture.
const FIXTURE_SLUG = "test-fixture-slug-xyz";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("verifyDevSlug", () => {
  it("returns true for the correct slug", () => {
    vi.stubEnv("MCP_DEV_SLUG", FIXTURE_SLUG);
    expect(verifyDevSlug(FIXTURE_SLUG)).toBe(true);
  });

  it("returns false for a wrong slug of the same length", () => {
    vi.stubEnv("MCP_DEV_SLUG", FIXTURE_SLUG);
    const wrongSameLength = "test-fixture-slug-abc";
    expect(wrongSameLength.length).toBe(FIXTURE_SLUG.length);
    expect(verifyDevSlug(wrongSameLength)).toBe(false);
  });

  it("returns false when the env var is unset, even for an empty candidate", () => {
    vi.stubEnv("MCP_DEV_SLUG", "");
    expect(verifyDevSlug("")).toBe(false);
    expect(verifyDevSlug(undefined)).toBe(false);
    expect(verifyDevSlug(null)).toBe(false);
  });

  it("returns false for a different-length candidate without throwing", () => {
    vi.stubEnv("MCP_DEV_SLUG", FIXTURE_SLUG);
    expect(() => verifyDevSlug(`${FIXTURE_SLUG}-extra`)).not.toThrow();
    expect(verifyDevSlug(`${FIXTURE_SLUG}-extra`)).toBe(false);
    expect(() => verifyDevSlug("x")).not.toThrow();
    expect(verifyDevSlug("x")).toBe(false);
  });

  it("returns false when the candidate is empty but the slug is set", () => {
    vi.stubEnv("MCP_DEV_SLUG", FIXTURE_SLUG);
    expect(verifyDevSlug("")).toBe(false);
  });
});

describe("getDevTestUserId", () => {
  it("returns the configured id", () => {
    vi.stubEnv("MCP_DEV_TEST_USER_ID", "00000000-0000-4000-8000-000000000000");
    expect(getDevTestUserId()).toBe("00000000-0000-4000-8000-000000000000");
  });

  it("throws when unset", () => {
    vi.stubEnv("MCP_DEV_TEST_USER_ID", "");
    expect(() => getDevTestUserId()).toThrow(/MCP_DEV_TEST_USER_ID/);
  });
});
