import { describe, expect, it } from "vitest";
import { DIGEST_PROGRESS_STEPS } from "./daily-digest";

describe("daily digest progress", () => {
  it("advances through a monotonic, bounded presentation sequence", () => {
    for (const [index, step] of DIGEST_PROGRESS_STEPS.entries()) {
      expect(step.pct).toBeGreaterThanOrEqual(0);
      expect(step.pct).toBeLessThanOrEqual(100);
      expect(step.label.length).toBeGreaterThan(0);

      if (index === 0) continue;
      expect(step.afterMs).toBeGreaterThan(
        DIGEST_PROGRESS_STEPS[index - 1].afterMs,
      );
      expect(step.pct).toBeGreaterThan(
        DIGEST_PROGRESS_STEPS[index - 1].pct,
      );
    }
  });

  it("stops short of completion until the digest response arrives", () => {
    expect(DIGEST_PROGRESS_STEPS.at(-1)?.pct).toBeLessThan(100);
  });
});
