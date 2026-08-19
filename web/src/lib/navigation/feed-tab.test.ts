import { describe, expect, it } from "vitest";
import { feedTypeFromSearchParams } from "./feed-tab";

describe("feed tab URL state", () => {
  it("mounts /?tab=jobs with Jobs active", () => {
    const params = new URL("https://peer.test/?tab=jobs").searchParams;

    expect(feedTypeFromSearchParams(params)).toBe("jobs");
  });

  it("falls back to Dashboard for an unknown tab", () => {
    const params = new URL("https://peer.test/?tab=unknown").searchParams;

    expect(feedTypeFromSearchParams(params)).toBe("dashboard");
  });
});
