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

  it("gates Brave exactly like the system Tavily key", () => {
    // REWRITTEN, NOT DELETED — ABC-freemium 2-04 · Ruling 5 point 2.
    //
    // This case used to be called "leaves Brave ungated, because D2 bans it on
    // Vercel anyway" and asserted that an unentitled caller still got the key.
    // The reasoning was that the build guard's ban made it unreachable — but a
    // ban on Vercel is not a gate on a self-host or a developer machine, and
    // Brave is operator-funded on both. It is one of the four providers Ruling
    // 5 point 2 puts behind one predicate.
    vi.stubEnv("TAVILY_API_KEY", "");
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "BRAVE-NOT-A-KEY");

    const denied = resolveSystemSearchKeys({ systemSearchAllowed: false });
    const allowed = resolveSystemSearchKeys({ systemSearchAllowed: true });

    expect(denied.brave).toBeUndefined();
    expect(allowed.brave).toBe("BRAVE-NOT-A-KEY");
    // Provenance still describes the TAVILY key specifically — its meaning is
    // deliberately not widened (2-04). No Tavily key resolved either way.
    expect(denied.provenance).toBe("none");
    expect(allowed.provenance).toBe("none");
  });

  it("withholds Brave from a BYOK caller who is not entitled", () => {
    // 2-04 — the BYOK branch returns early and used to carry the ungated Brave
    // key out with it, so a reader's own Tavily key doubled as a free pass to
    // the operator's Brave account.
    vi.stubEnv("BRAVE_SEARCH_API_KEY", "BRAVE-NOT-A-KEY");

    const keys = resolveSystemSearchKeys({
      requestTavilyKey: "USER-NOT-A-KEY",
      systemSearchAllowed: false,
    });

    expect(keys.provenance).toBe("byok");
    expect(keys.tavily).toBe("USER-NOT-A-KEY");
    expect(keys.brave).toBeUndefined();
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
