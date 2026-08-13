import { describe, expect, it } from "vitest";
import vm from "node:vm";
import type { DailyForecastResult, ForecastItem } from "../types";
import {
  __getWidgetScriptForTest,
  buildDailyForecastWidgetHtml,
  renderDailyForecastText,
} from "./daily-forecast-card";

const JOB_ITEM: ForecastItem = {
  id: "remotive:a",
  type: "job",
  title: "ML Research Intern",
  org: "Meridian Labs",
  location: "Boston / Remote",
  posted: "2026-08-10T00:00:00.000Z",
  deadline: "2026-09-01",
  relevance: 0.92,
  whyItMatters: "Matches your HCI x ML focus",
  tags: ["visa-ok"],
  deepLink: "https://remotive.com/jobs/a",
  isSaved: false,
};

// Deliberately no `location`/`deadline` keys at all -- exactly what
// paperToForecastItem produces (RULING 4).
const PAPER_ITEM: ForecastItem = {
  id: "arxiv:2508.00001",
  type: "paper",
  title: "Learning-Based Planning",
  org: "arXiv",
  posted: "2026-08-11T00:00:00.000Z",
  relevance: 0.74,
  whyItMatters: "Matches your machine learning interest",
  tags: ["cs.RO"],
  deepLink: "https://arxiv.org/abs/2508.00001",
  isSaved: false,
};

function forecast(items: ForecastItem[]): DailyForecastResult {
  return {
    date: "2026-08-12",
    generatedAt: "2026-08-12T12:00:00.000Z",
    counts: {
      jobs: items.filter((i) => i.type === "job").length,
      papers: items.filter((i) => i.type === "paper").length,
      events: items.filter((i) => i.type === "event").length,
      total: items.length,
      shown: items.length,
    },
    items,
  };
}

/**
 * Executes the actual WIDGET_SCRIPT text (the same string embedded in the
 * static ui:// resource, byte for byte) inside a Node `vm` sandbox with a
 * minimal DOM stub, captures the `message` listener the script registers,
 * fires a synthetic `ui/notifications/tool-result` postMessage event at it
 * exactly the way the host would, and returns the resulting innerHTML.
 * This is real behavioral coverage of the client-side rendering logic, not
 * a substring check on the generated source.
 */
function runWidgetScriptAndRender(result: DailyForecastResult): {
  headHtml: string;
  rowsHtml: string;
} {
  const elements: Record<string, { innerHTML: string }> = {
    "pc-head-slot": { innerHTML: "" },
    "rows-slot": { innerHTML: "" },
  };
  let messageListener: ((event: { source: unknown; data: unknown }) => void) | undefined;

  const fakeWindow = {
    addEventListener: (type: string, listener: typeof messageListener) => {
      if (type === "message") messageListener = listener;
    },
    parent: "the-host-parent",
  };

  const sandbox = {
    window: fakeWindow,
    document: {
      getElementById: (id: string) => elements[id],
    },
    Intl,
    Date,
    Math,
    isNaN,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(__getWidgetScriptForTest(), sandbox, { timeout: 1000 });

  expect(messageListener).toBeTypeOf("function");
  messageListener!({
    source: "the-host-parent",
    data: {
      jsonrpc: "2.0",
      method: "ui/notifications/tool-result",
      params: { structuredContent: result },
    },
  });

  return { headHtml: elements["pc-head-slot"].innerHTML, rowsHtml: elements["rows-slot"].innerHTML };
}

describe("buildDailyForecastWidgetHtml (static template)", () => {
  it("uses the fixed warm palette's literal hex values, not CSS custom properties", () => {
    const html = buildDailyForecastWidgetHtml();
    expect(html).toContain("#FDF6EE"); // --color-bg
    expect(html).toContain("#2B180A"); // --color-heading
    expect(html).toContain("#FF520D"); // --color-accent
    expect(html).toContain("#237A4B"); // .rel
    expect(html).toContain("#A8642A"); // .p-row .why
    expect(html).not.toMatch(/var\(--/);
  });

  it("never mentions Save or Expand (RULING 7 — no dead controls)", () => {
    const html = buildDailyForecastWidgetHtml();
    expect(html.toLowerCase()).not.toContain("save");
    expect(html.toLowerCase()).not.toContain("expand");
    expect(html).not.toContain("psave");
  });

  it("includes the Open in Peer footer link and attribution, baked in once", () => {
    const html = buildDailyForecastWidgetHtml();
    expect(html).toContain("Open in Peer");
    expect(html).toContain("data from your Peer account");
  });

  it("wires the ui/notifications/tool-result postMessage bridge, not per-call server data", () => {
    const html = buildDailyForecastWidgetHtml();
    expect(html).toContain("ui/notifications/tool-result");
    expect(html).toContain("window.parent");
    expect(html).toContain('jsonrpc !== "2.0"');
  });

  it("is identical across two calls -- a static template, not baked per-call data (the actual bug this item fixes)", () => {
    expect(buildDailyForecastWidgetHtml()).toBe(buildDailyForecastWidgetHtml());
  });
});

describe("WIDGET_SCRIPT executed in a sandbox (real client-side behavior)", () => {
  it("renders a job row with full meta and a why-line", () => {
    const { headHtml, rowsHtml } = runWidgetScriptAndRender(forecast([JOB_ITEM]));
    expect(headHtml).toContain("1/1");
    expect(rowsHtml).toContain("92%");
    expect(rowsHtml).toContain("ML Research Intern");
    expect(rowsHtml).toContain("Meridian Labs");
    expect(rowsHtml).toContain("Boston / Remote");
    expect(rowsHtml).toContain("deadline");
    expect(rowsHtml).toContain("Matches your HCI x ML focus");
    expect(rowsHtml).toContain(">Job<");
  });

  it("never renders a location or deadline for a paper item with neither field (RULING 4, executed client-side)", () => {
    const { rowsHtml } = runWidgetScriptAndRender(forecast([PAPER_ITEM]));
    expect(rowsHtml).not.toMatch(/deadline/i);
    expect(rowsHtml).not.toMatch(/·\s*·/);
    expect(rowsHtml).toContain("arXiv");
    expect(rowsHtml).toContain("Learning-Based Planning");
  });

  it("HTML-escapes item text so real external data can't break the markup", () => {
    const dangerous: ForecastItem = {
      ...JOB_ITEM,
      title: 'Title <script>alert(1)</script> & "quotes"',
    };
    const { rowsHtml } = runWidgetScriptAndRender(forecast([dangerous]));
    expect(rowsHtml).not.toContain("<script>alert(1)</script>");
    expect(rowsHtml).toContain("&lt;script&gt;");
  });

  it("shows a graceful empty state instead of crashing on zero items", () => {
    const { rowsHtml } = runWidgetScriptAndRender(forecast([]));
    expect(rowsHtml).toContain("No forecast items today.");
  });

  it("ignores a message from a source other than window.parent", () => {
    const elements: Record<string, { innerHTML: string }> = {
      "pc-head-slot": { innerHTML: "untouched" },
      "rows-slot": { innerHTML: "untouched" },
    };
    let messageListener: ((event: { source: unknown; data: unknown }) => void) | undefined;
    const sandbox = {
      window: {
        addEventListener: (type: string, listener: typeof messageListener) => {
          if (type === "message") messageListener = listener;
        },
        parent: "the-real-host",
      },
      document: { getElementById: (id: string) => elements[id] },
      Intl,
      Date,
      Math,
      isNaN,
      console,
    };
    vm.createContext(sandbox);
    vm.runInContext(__getWidgetScriptForTest(), sandbox, { timeout: 1000 });

    messageListener!({
      source: "some-other-frame",
      data: {
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: { structuredContent: forecast([JOB_ITEM]) },
      },
    });

    expect(elements["pc-head-slot"].innerHTML).toBe("untouched");
    expect(elements["rows-slot"].innerHTML).toBe("untouched");
  });
});

describe("renderDailyForecastText", () => {
  it("contains every item's title and deep link", () => {
    const text = renderDailyForecastText(forecast([JOB_ITEM, PAPER_ITEM]));
    expect(text).toContain(JOB_ITEM.title);
    expect(text).toContain(JOB_ITEM.deepLink);
    expect(text).toContain(PAPER_ITEM.title);
    expect(text).toContain(PAPER_ITEM.deepLink);
  });

  it("never mentions a deadline for the paper item (RULING 4)", () => {
    const text = renderDailyForecastText(forecast([PAPER_ITEM]));
    const paperLine = text.split("\n").find((l) => l.includes(PAPER_ITEM.title));
    expect(paperLine).toBeTruthy();
    expect(paperLine).not.toMatch(/deadline/i);
  });

  it("says so plainly when there are no items, rather than an empty string", () => {
    const text = renderDailyForecastText(forecast([]));
    expect(text.length).toBeGreaterThan(0);
    expect(text.toLowerCase()).toContain("no items");
  });
});
