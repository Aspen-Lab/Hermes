import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveSystemSearchKeys } from "./system-key";

/**
 * ABC-freemium 1-05 · R-KEY-3.
 *
 * B's guide puts unit (b)'s tests in 1-09 (the three route tests). This file is
 * additional: 1-09 proves the routes send no operator key, and this proves the
 * resolver's order in isolation, so a failure says which of the two broke.
 *
 * The sentinel strings below are deliberately not key-shaped.
 */

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("resolveSystemSearchKeys", () => {
  it("prefers the user's own key over everything", () => {
    vi.stubEnv("TAVILY_API_KEY", "OPERATOR-NOT-A-KEY");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");

    expect(
      resolveSystemSearchKeys({
        requestTavilyKey: "  USER-NOT-A-KEY  ",
        systemSearchAllowed: true,
      }),
    ).toEqual({
      tavily: "USER-NOT-A-KEY",
      brave: undefined,
      provenance: "byok",
    });
  });

  it("gives an entitled request the operator's key", () => {
    vi.stubEnv("TAVILY_API_KEY", "OPERATOR-NOT-A-KEY");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");

    expect(resolveSystemSearchKeys({ systemSearchAllowed: true })).toEqual({
      tavily: "OPERATOR-NOT-A-KEY",
      brave: undefined,
      provenance: "system",
    });
  });

  it("gives an UNENTITLED request nothing, however the key is set", () => {
    // This is the whole item. Before it, this call returned the operator's key
    // to anyone who could reach a route — signed in or not, entitled or not.
    vi.stubEnv("TAVILY_API_KEY", "OPERATOR-NOT-A-KEY");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");

    expect(resolveSystemSearchKeys({ systemSearchAllowed: false })).toEqual({
      tavily: undefined,
      brave: undefined,
      provenance: "none",
    });
  });

  it("ignores a blank request key rather than treating it as BYOK", () => {
    // `parseSearchConnectors` drops an empty key, but a whitespace one could
    // still arrive; it must not read as the user's own.
    vi.stubEnv("TAVILY_API_KEY", "OPERATOR-NOT-A-KEY");

    expect(
      resolveSystemSearchKeys({
        requestTavilyKey: "   ",
        systemSearchAllowed: false,
      }).provenance,
    ).toBe("none");
  });

  it("leaves Brave ungated, because D2 bans it on Vercel anyway", () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "BRAVE-NOT-A-KEY");

    const keys = resolveSystemSearchKeys({ systemSearchAllowed: false });

    expect(keys.brave).toBe("BRAVE-NOT-A-KEY");
    // Provenance describes the TAVILY key, which is the only thing R-METER-2
    // counts. No Tavily key resolved, so nothing to attribute.
    expect(keys.provenance).toBe("none");
  });

  it("returns nothing when no candidate survives", () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "");

    expect(resolveSystemSearchKeys({ systemSearchAllowed: true })).toEqual({
      tavily: undefined,
      brave: undefined,
      provenance: "none",
    });
  });
});
