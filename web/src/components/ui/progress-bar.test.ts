import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./progress-bar";

function renderProgress(pct: number) {
  return renderToStaticMarkup(
    createElement(ProgressBar, { pct, label: "Writing the report" }),
  );
}

describe("ProgressBar", () => {
  it.each([
    { pct: -10, expected: 0 },
    { pct: 35, expected: 35 },
    { pct: 140, expected: 100 },
    { pct: Number.NaN, expected: 0 },
  ])("clamps $pct to $expected", ({ pct, expected }) => {
    const html = renderProgress(pct);

    expect(html).toContain(`aria-valuenow="${expected}"`);
    expect(html).toContain(`width:${expected}%`);
  });

  it("exposes its visible label as the progressbar name", () => {
    const html = renderProgress(75);

    expect(html).toContain('role="progressbar"');
    expect(html).toContain('aria-valuemin="0"');
    expect(html).toContain('aria-valuemax="100"');
    expect(html).toContain('aria-label="Writing the report"');
  });
});
