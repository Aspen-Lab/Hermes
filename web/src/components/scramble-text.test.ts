import { describe, expect, it } from "vitest";
import { resolveRevealMode } from "./scramble-text";

describe("resolveRevealMode", () => {
  it("plays the decode animation when the system allows motion", () => {
    expect(resolveRevealMode("auto", false)).toBe("scramble");
  });

  it("falls back to a gentle fade when the system asks for reduced motion", () => {
    // Reduced motion must still show the text building up — just without the
    // rapid character flashing the setting exists to suppress.
    expect(resolveRevealMode("auto", true)).toBe("fade");
  });

  it("lets an explicit user opt-in override the system preference", () => {
    expect(resolveRevealMode("full", true)).toBe("scramble");
  });

  it("keeps the animation for an opted-in reader with motion allowed", () => {
    expect(resolveRevealMode("full", false)).toBe("scramble");
  });
});
