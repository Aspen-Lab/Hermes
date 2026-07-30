import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TierUpgradeBlock } from "./tier-upgrade-block";

const items = [
  {
    title: "Tailored next steps",
    description: "Connect the evidence to your current work.",
  },
  {
    title: "Deeper source review",
    description: "Read the full source for caveats and implications.",
  },
];

describe("TierUpgradeBlock", () => {
  it("renders locked rows and the setup link without a provider", () => {
    const html = renderToStaticMarkup(
      createElement(TierUpgradeBlock, {
        items,
        providerConfigured: false,
      }),
    );

    expect(html).toContain("Also in this report with an AI key");
    expect(html).toContain("Tailored next steps");
    expect(html).toContain("Deeper source review");
    expect(html).toContain("Connect a key");
    expect(html).toContain('href="/welcome?step=ai"');
  });

  it("renders nothing when a provider is configured", () => {
    expect(
      renderToStaticMarkup(
        createElement(TierUpgradeBlock, {
          items,
          providerConfigured: true,
        }),
      ),
    ).toBe("");
  });
});
