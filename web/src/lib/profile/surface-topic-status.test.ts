import { describe, expect, it } from "vitest";
import { surfaceTopicStatus } from "./surface-topic-status";

describe("surfaceTopicStatus", () => {
  it("omits change status when active and pending pairs match", () => {
    expect(
      surfaceTopicStatus(
        { required: ["battery"], explore: ["molten salt"] },
        { required: ["battery"], explore: ["molten salt"] },
      ),
    ).toEqual({
      differs: false,
      activeSummary: "battery · molten salt (Explore)",
      pendingSummary: "battery · molten salt (Explore)",
    });
  });

  it("shows distinct snapshots when pending topics or classifications differ", () => {
    expect(
      surfaceTopicStatus(
        { required: ["battery", "molten salt"], explore: [] },
        {
          required: ["battery"],
          explore: ["molten salt", "sodium-ion"],
        },
      ),
    ).toEqual({
      differs: true,
      activeSummary: "battery · molten salt",
      pendingSummary:
        "battery · molten salt (Explore) · sodium-ion (Explore)",
    });
  });
});
