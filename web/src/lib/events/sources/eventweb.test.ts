import { describe, expect, it } from "vitest";
import {
  eventNameFrom,
  looksLikeEventTitle,
  webResultToRawEventItem,
} from "./eventweb";

// No test file existed for this source adapter before B4-01 (round 4) — see
// MULTIAGENT-report-parity.md, B4-01's own risk note. These are foundational
// cases for the existing fallback chain plus the new title-shape guard;
// this file does not attempt full coverage of every helper in eventweb.ts.

describe("looksLikeEventTitle", () => {
  it("rejects a narrative sentence about the event, not its name", () => {
    // Same shape as B4-01's real repro (a page whose H1 rendered as a
    // sentence describing the event's history rather than its name),
    // paraphrased rather than quoted verbatim.
    expect(
      looksLikeEventTitle(
        "Rivertown Summit was originally planned for 2020 but was delayed due to a global outbreak.",
      ),
    ).toBe(false);
    expect(looksLikeEventTitle("The workshop has been postponed until further notice.")).toBe(
      false,
    );
  });

  it("rejects a candidate that is more than one sentence", () => {
    expect(
      looksLikeEventTitle("Registration is now open. Book your seat today for the workshop."),
    ).toBe(false);
  });

  it("does not mistake a mid-title abbreviation for a sentence boundary", () => {
    expect(looksLikeEventTitle("Dr. James Wong Memorial Lecture Series")).toBe(true);
    expect(looksLikeEventTitle("U.S. National Conference on Materials Science")).toBe(true);
  });

  it("accepts real, long event names", () => {
    expect(
      looksLikeEventTitle(
        "The First European Conference on Molten Salt Reactor Chemistry and Technology",
      ),
    ).toBe(true);
    expect(looksLikeEventTitle("Solid-State Battery Summit 2026")).toBe(true);
  });

  it("rejects an implausibly long run of prose with no other tell", () => {
    const longRun = Array.from({ length: 25 }, (_, i) => `topic${i}`).join(" ");
    expect(looksLikeEventTitle(longRun)).toBe(false);
  });

  it("rejects an empty or blank candidate", () => {
    expect(looksLikeEventTitle("")).toBe(false);
    expect(looksLikeEventTitle("   ")).toBe(false);
  });
});

describe("eventNameFrom", () => {
  it("picks the informative segment over site chrome", () => {
    expect(eventNameFrom("Solid-State Battery Summit | Cambridge EnerTech", "")).toBe(
      "Solid-State Battery Summit",
    );
  });

  it("falls through to snippet mining when the whole title is a sentence", () => {
    const title =
      "Rivertown Summit was originally planned for 2020 but was delayed due to a global outbreak.";
    const snippet =
      "Rivertown Summit is a two-day materials science conference held every spring.";
    expect(eventNameFrom(title, snippet)).toBe(
      "Rivertown Summit is a two-day materials science conference held every spring.",
    );
  });

  it("falls through to the URL slug when both title and snippet fail every check", () => {
    const title = "Rivertown Summit was originally planned for 2020 but was delayed.";
    const snippet = "";
    const url = "https://example.com/events/rivertown-materials-summit-2026";
    // nameFromUrlSlug only title-cases the very first character; the rest of
    // the slug's own casing (already lowercase) passes through unchanged.
    expect(eventNameFrom(title, snippet, url)).toBe("Rivertown materials summit 2026");
  });

  it("still resolves when every title segment is chrome, same as before this round", () => {
    expect(eventNameFrom("Home | Events", "", undefined)).toBe("Home");
  });
});

describe("webResultToRawEventItem", () => {
  it("uses the guarded name for a real-shaped result", () => {
    const item = webResultToRawEventItem(
      {
        title: "Advanced Battery Materials Workshop 2026",
        url: "https://example.com/events/advanced-battery-materials-workshop",
        snippet: "Join researchers for the annual workshop on battery materials.",
      },
      Date.parse("2026-01-01T00:00:00Z"),
    );
    expect(item?.name).toBe("Advanced Battery Materials Workshop 2026");
  });

  it("does not let a narrative-sentence title through as the event name", () => {
    // No year mentioned here — webResultToRawEventItem separately drops a
    // result when every year it mentions is already in the past, which is
    // not what this case is testing.
    const item = webResultToRawEventItem(
      {
        title: "Rivertown Summit was originally scheduled early but was delayed significantly.",
        url: "https://example.com/events/rivertown-summit",
        snippet: "Rivertown Summit convenes battery researchers every spring in Ohio.",
      },
      Date.parse("2026-01-01T00:00:00Z"),
    );
    expect(item?.name).not.toMatch(/\bwas\b/i);
    expect(item?.name).toBe("Rivertown Summit convenes battery researchers every spring in Ohio.");
  });
});
