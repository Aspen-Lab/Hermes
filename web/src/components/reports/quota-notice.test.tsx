import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { QuotaNotice } from "./quota-notice";
import type { QuotaSignal } from "@/lib/usage/deep-report-quota";

/**
 * ABC-freemium 2-07 · R-QUOTA-1 · Ruling 3 point 1 · Ruling 4 point 2 ·
 * Ruling 6 point 2.
 *
 * The strings are asserted **byte-for-byte** because they are the requirement's
 * own text, not a paraphrase of it.
 */

const EXHAUSTED: QuotaSignal = {
  kind: "deep_report",
  reason: "exhausted",
  remaining: 0,
  // Far enough out that the day count is stable whenever this suite runs.
  resetsAt: "2099-01-01T00:00:00.000Z",
};

const UNAVAILABLE: QuotaSignal = {
  kind: "deep_report",
  reason: "unavailable",
  remaining: 0,
  resetsAt: "2099-01-01T00:00:00.000Z",
};

function render(quota?: QuotaSignal): string {
  return renderToStaticMarkup(createElement(QuotaNotice, { quota }));
}

describe("QuotaNotice", () => {
  it("renders NOTHING when there is no quota signal", () => {
    // The overwhelmingly common case: the reader had allowance and was served.
    // "Never a heading over nothing" — not an empty panel, not a placeholder.
    expect(render(undefined)).toBe("");
  });

  it("shows the exhaustion sentence AND an upgrade prompt", () => {
    const html = render(EXHAUSTED);

    expect(html).toContain("You&#x27;ve used this month&#x27;s deep reports.");
    expect(html).toContain("Peer Pro");
    expect(html).toContain('data-quota-reason="exhausted"');
  });

  it("shows the outage copy and NO upgrade prompt", () => {
    // Nothing the reader buys fixes a counter-store outage, so an upsell here
    // would be a second lie on top of the one 2-02 removed.
    const html = render(UNAVAILABLE);

    expect(html).toContain(
      "Deep reports are temporarily unavailable — your allowance is unchanged. Try again shortly.",
    );
    expect(html).not.toContain("Peer Pro");
    expect(html).not.toContain("/settings");
    expect(html).toContain('data-quota-reason="unavailable"');
  });

  it("never shows the exhaustion wording during an outage", () => {
    // The two states used to be byte-identical in the payload (2-02). This is
    // what stops them becoming byte-identical again on the screen.
    const html = render(UNAVAILABLE);

    expect(html).not.toContain("used this month");
    expect(html).not.toContain("Resets in");
  });

  it("says the daily-breaker sentence for a paid reader at the cap", () => {
    const html = render({
      kind: "breaker",
      reason: "exhausted",
      remaining: 0,
      resetsAt: "2099-01-01T00:00:00.000Z",
    });

    expect(html).toContain("Peer is at today&#x27;s limit for deep reports.");
  });

  it("contains no CJK characters", () => {
    // Ruling 3 point 1 — the product is English-only, and the guard follows the
    // string onto the screen rather than stopping at the pure function.
    for (const quota of [EXHAUSTED, UNAVAILABLE]) {
      expect(/[一-鿿]/.test(render(quota))).toBe(false);
    }
  });
});

/**
 * ABC-freemium 2-07 — **the three report pages actually read and render it.**
 *
 * The component being correct is not the requirement; the requirement is that a
 * reader sees it. For a whole round the server computed a correct message,
 * tested it three ways, and showed it to nobody — so the placement is asserted
 * here rather than trusted. These are source-text assertions for the same
 * reason `spend-scans.test.ts`'s are: they are placement rules, and rendering
 * three ~2500-line page components in a unit test would assert far less for far
 * more setup.
 */
describe("the report pages render the notice (R-QUOTA-1's UI half)", () => {
  const PAGES = [
    "src/app/jobs/[id]/page.tsx",
    "src/app/events/[id]/page.tsx",
    "src/app/papers/[id]/page.tsx",
  ];

  function source(file: string): string {
    return readFileSync(join(process.cwd(), file), "utf8");
  }

  it.each(PAGES)("%s reads `quota` off the response", (file) => {
    // B established that all three fetchers destructured the degraded payload
    // and dropped `quota` on the floor — on papers it was not even reachable in
    // TypeScript, because `PaperReport` had no such field.
    expect(source(file)).toMatch(/setQuota\(/);
  });

  it.each(PAGES)("%s renders QuotaNotice", (file) => {
    expect(source(file)).toContain("<QuotaNotice");
  });

  it.each(PAGES)("%s keeps the signal OUT of the cached report object", (file) => {
    // All three pages cache their report in browser storage. A cached quota
    // signal is a stale one: it would keep telling a reader they had spent
    // their allowance after they upgraded, which is the cache-poisoning shape
    // R-UI-4 exists to prevent. The signal therefore lives in its own state,
    // set only when a fetch actually runs.
    expect(source(file)).toMatch(
      /useState<QuotaSignal \| undefined>\(undefined\)/,
    );
  });
});
