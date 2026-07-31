import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CountryMultiSelect } from "./country-multi-select";

describe("CountryMultiSelect", () => {
  it("renders existing work rights and a uniquely labelled search control", () => {
    const markup = renderToStaticMarkup(
      createElement(CountryMultiSelect, {
        values: ["United States", "Canada"],
        onChange: vi.fn(),
        idPrefix: "welcome-work-rights",
      }),
    );

    expect(markup).toContain("United States");
    expect(markup).toContain("Canada");
    expect(markup).toContain('id="welcome-work-rights"');
    expect(markup).toContain("Search countries");
  });
});
