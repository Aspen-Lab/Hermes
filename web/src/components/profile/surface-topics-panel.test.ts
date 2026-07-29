import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SurfaceTopicsPanel } from "./surface-topics-panel";

function renderPanel({
  activeRequired,
  activeExplore,
  required,
  explore,
}: {
  activeRequired: string[];
  activeExplore: string[];
  required: string[];
  explore: string[];
}) {
  return renderToStaticMarkup(
    createElement(SurfaceTopicsPanel, {
      surface: "events",
      activeRequired,
      activeExplore,
      required,
      explore,
      onChangeRequired: vi.fn(),
      onChangeExplore: vi.fn(),
      defaultExpanded: false,
    }),
  );
}

describe("SurfaceTopicsPanel", () => {
  it("shows active and pending snapshots when they differ", () => {
    const markup = renderPanel({
      activeRequired: ["battery"],
      activeExplore: [],
      required: ["battery", "sodium-ion"],
      explore: [],
    });

    expect(markup).toContain("Active now");
    expect(markup).toContain("Pending tomorrow");
    expect(markup).toContain("sodium-ion");
    expect(markup).toContain("Changes take effect in tomorrow");
  });

  it("hides snapshots but keeps the timing line when values match", () => {
    const markup = renderPanel({
      activeRequired: ["battery"],
      activeExplore: ["molten salt"],
      required: ["battery"],
      explore: ["molten salt"],
    });

    expect(markup).not.toContain("Active now");
    expect(markup).not.toContain("Pending tomorrow");
    expect(markup).toContain("Changes take effect in tomorrow");
  });
});
