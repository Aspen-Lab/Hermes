import { describe, expect, it } from "vitest";
import vm from "node:vm";
import type { DailyForecastResult, ForecastItem } from "../types";
import {
  __getHomeWidgetScriptForTest,
  buildDailyForecastHomeWidgetHtml,
} from "./daily-forecast-home";

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

function forecast(
  items: ForecastItem[],
  overrides: Partial<DailyForecastResult> = {},
): DailyForecastResult {
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
    ...overrides,
  };
}

interface StubElement {
  innerHTML: string;
  textContent: string;
  listeners: Record<string, Array<(event: unknown) => void>>;
  addEventListener: (type: string, fn: (event: unknown) => void) => void;
}

function makeStubElement(): StubElement {
  return {
    innerHTML: "",
    textContent: "",
    listeners: {},
    addEventListener(type, fn) {
      (this.listeners[type] ??= []).push(fn);
    },
  };
}

/**
 * Executes the actual HOME_WIDGET_SCRIPT text inside a Node `vm` sandbox
 * with a minimal DOM + `window.openai` stub, the same real-behavior-not-
 * substring-check pattern daily-forecast-card.test.ts already uses.
 */
function runHomeWidget() {
  const elements: Record<string, StubElement> = {
    "pf-h-slot": makeStubElement(),
    "pf-sub-slot": makeStubElement(),
    "chips-slot": makeStubElement(),
    "grid-slot": makeStubElement(),
  };
  let messageListener: ((event: { source: unknown; data: unknown }) => void) | undefined;
  const openaiCalls = {
    callTool: [] as Array<[string, unknown]>,
    requestDisplayMode: [] as unknown[],
  };

  const fakeWindow = {
    addEventListener: (
      type: string,
      listener: (event: { source: unknown; data: unknown }) => void,
    ) => {
      if (type === "message") messageListener = listener;
    },
    parent: "the-host-parent",
    openai: {
      callTool: (name: string, args: unknown) => {
        openaiCalls.callTool.push([name, args]);
        return Promise.resolve({});
      },
      requestDisplayMode: (opts: unknown) => {
        openaiCalls.requestDisplayMode.push(opts);
      },
    },
  };

  const sandbox = {
    window: fakeWindow,
    document: { getElementById: (id: string) => elements[id] },
    Intl,
    Date,
    Math,
    isNaN,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(__getHomeWidgetScriptForTest(), sandbox, { timeout: 1000 });

  expect(messageListener).toBeTypeOf("function");

  function fireResult(result: DailyForecastResult) {
    messageListener!({
      source: "the-host-parent",
      data: {
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: { structuredContent: result },
      },
    });
  }

  function clickChip(dataType: string) {
    const listeners = elements["chips-slot"].listeners["click"] ?? [];
    for (const fn of listeners) {
      fn({ target: { getAttribute: (attr: string) => (attr === "data-type" ? dataType : null) } });
    }
  }

  return { elements, fireResult, clickChip, openaiCalls };
}

describe("buildDailyForecastHomeWidgetHtml (static template)", () => {
  it("uses the fixed warm palette's literal hex values, not CSS custom properties", () => {
    const html = buildDailyForecastHomeWidgetHtml();
    expect(html).toContain("#FDF6EE");
    expect(html).toContain("#2B180A");
    expect(html).toContain("#FF520D");
    expect(html).toContain("#237A4B");
    expect(html).toContain("#A8642A");
    expect(html).not.toMatch(/var\(--/);
  });

  it("is identical across two calls -- a static template, not baked per-call data", () => {
    expect(buildDailyForecastHomeWidgetHtml()).toBe(buildDailyForecastHomeWidgetHtml());
  });

  it("draws no Peer close button and reserves no composer layout space (both host chrome)", () => {
    const html = buildDailyForecastHomeWidgetHtml();
    expect(html).not.toContain("pf-composer");
    expect(html).not.toMatch(/class="x"/);
  });

  it("uses the serif font stack for the date header", () => {
    const html = buildDailyForecastHomeWidgetHtml();
    expect(html).toContain('.pf-h{font-family:"Iowan Old Style",Georgia,serif');
  });

  it("includes the top bar with Open in Peer, no static chip/grid content baked in", () => {
    const html = buildDailyForecastHomeWidgetHtml();
    expect(html).toContain("Open in Peer");
    expect(html).toContain('id="chips-slot"></div>');
    expect(html).toContain('id="grid-slot"></div>');
  });
});

describe("HOME_WIDGET_SCRIPT executed in a sandbox (real client-side behavior)", () => {
  it("requests fullscreen exactly once, unconditionally, on load", () => {
    const { openaiCalls } = runHomeWidget();
    expect(openaiCalls.requestDisplayMode).toEqual([{ mode: "fullscreen" }]);
  });

  it("registers exactly two addEventListener calls (message bridge + chip delegation) -- acts-btn is never wired", () => {
    const count = (__getHomeWidgetScriptForTest().match(/\.addEventListener\(/g) ?? []).length;
    expect(count).toBe(2);
  });

  it("renders all four chips with real counts from an unfiltered result", () => {
    const { elements, fireResult } = runHomeWidget();
    fireResult(forecast([JOB_ITEM, JOB_ITEM, PAPER_ITEM], {
      counts: { jobs: 2, papers: 1, events: 1, total: 4, shown: 4 },
    }));
    const chips = elements["chips-slot"].innerHTML;
    expect(chips).toContain("All · 4");
    expect(chips).toContain("Papers · 1");
    expect(chips).toContain("Events · 1");
    expect(chips).toContain("Jobs · 2");
  });

  it("a chip click calls window.openai.callTool(\"open_home\", {type}) with the same mounted tool", () => {
    const { fireResult, clickChip, openaiCalls } = runHomeWidget();
    fireResult(forecast([JOB_ITEM], { counts: { jobs: 2, papers: 1, events: 1, total: 4, shown: 4 } }));
    clickChip("job");
    expect(openaiCalls.callTool).toEqual([["open_home", { type: "job" }]]);
  });

  it("a later type-filtered result does not zero out the other chips' cached counts (tension (a) regression test)", () => {
    const { elements, fireResult, clickChip } = runHomeWidget();
    fireResult(forecast([JOB_ITEM], { counts: { jobs: 2, papers: 1, events: 1, total: 4, shown: 4 } }));
    clickChip("job");
    // Simulates the refetch's answer: a jobs-only call zeroes papers/events.
    fireResult(forecast([JOB_ITEM, JOB_ITEM], {
      counts: { jobs: 2, papers: 0, events: 0, total: 2, shown: 2 },
    }));
    const chips = elements["chips-slot"].innerHTML;
    expect(chips).toContain("All · 4");
    expect(chips).toContain("Papers · 1");
    expect(chips).toContain("Events · 1");
    expect(chips).toContain("Jobs · 2");
    expect(chips).toContain('class="fchip on" data-type="job"');
  });

  it("renders the date header and an honest 'shown of total' sub-line when the pool is capped", () => {
    const { elements, fireResult } = runHomeWidget();
    fireResult(forecast([JOB_ITEM], { counts: { jobs: 1, papers: 0, events: 0, total: 10, shown: 4 } }));
    expect(elements["pf-h-slot"].textContent).toContain("August 12");
    expect(elements["pf-sub-slot"].innerHTML).toContain("4 shown of 10 considered today");
  });

  it("renders a plain 'N opportunities today' sub-line when nothing was hidden", () => {
    const { elements, fireResult } = runHomeWidget();
    fireResult(forecast([JOB_ITEM]));
    expect(elements["pf-sub-slot"].innerHTML).toContain("1 opportunities today");
  });

  it("says 'ranked for {name}'s Persona' when personaName is present, a true generic fallback when absent", () => {
    const { elements, fireResult } = runHomeWidget();
    fireResult(forecast([JOB_ITEM], { personaName: "mei.lin" }));
    expect(elements["pf-sub-slot"].innerHTML).toContain("ranked for <b>mei.lin</b>'s Persona");

    const { elements: elements2, fireResult: fireResult2 } = runHomeWidget();
    fireResult2(forecast([JOB_ITEM]));
    expect(elements2["pf-sub-slot"].innerHTML).toContain("ranked for your Persona");
  });

  it("renders a job card with a linked title, full meta, and a disabled-visible actions row (RULING 10)", () => {
    const { elements, fireResult } = runHomeWidget();
    fireResult(forecast([JOB_ITEM]));
    const grid = elements["grid-slot"].innerHTML;
    expect(grid).toContain("92%");
    expect(grid).toContain(`<a href="${JOB_ITEM.deepLink}"`);
    expect(grid).toContain("ML Research Intern");
    expect(grid).toContain("Meridian Labs");
    expect(grid).toContain("deadline");
    expect((grid.match(/aria-disabled="true"/g) ?? []).length).toBe(3);
    expect(grid).toContain(">Save<");
    expect(grid).toContain(">Dismiss<");
    expect(grid).toContain("Report →");
  });

  it("never renders a location or deadline for a paper item with neither field (RULING 4, executed client-side)", () => {
    const { elements, fireResult } = runHomeWidget();
    fireResult(forecast([PAPER_ITEM]));
    const grid = elements["grid-slot"].innerHTML;
    expect(grid).not.toMatch(/deadline/i);
    expect(grid).toContain("arXiv");
    expect(grid).toContain("Learning-Based Planning");
  });

  it("HTML-escapes item text so real external data can't break the markup", () => {
    const dangerous: ForecastItem = {
      ...JOB_ITEM,
      title: 'Title <script>alert(1)</script> & "quotes"',
    };
    const { elements, fireResult } = runHomeWidget();
    fireResult(forecast([dangerous]));
    const grid = elements["grid-slot"].innerHTML;
    expect(grid).not.toContain("<script>alert(1)</script>");
    expect(grid).toContain("&lt;script&gt;");
  });

  it("shows a graceful empty state instead of crashing on zero items", () => {
    const { elements, fireResult } = runHomeWidget();
    fireResult(forecast([]));
    expect(elements["grid-slot"].innerHTML).toContain("No forecast items today.");
  });

  it("ignores a message from a source other than window.parent", () => {
    const elements: Record<string, StubElement> = {
      "pf-h-slot": makeStubElement(),
      "pf-sub-slot": makeStubElement(),
      "chips-slot": makeStubElement(),
      "grid-slot": makeStubElement(),
    };
    elements["grid-slot"].innerHTML = "untouched";
    let messageListener: ((event: { source: unknown; data: unknown }) => void) | undefined;
    const sandbox = {
      window: {
        addEventListener: (
          type: string,
          listener: (event: { source: unknown; data: unknown }) => void,
        ) => {
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
    vm.runInContext(__getHomeWidgetScriptForTest(), sandbox, { timeout: 1000 });

    messageListener!({
      source: "some-other-frame",
      data: {
        jsonrpc: "2.0",
        method: "ui/notifications/tool-result",
        params: { structuredContent: forecast([JOB_ITEM]) },
      },
    });

    expect(elements["grid-slot"].innerHTML).toBe("untouched");
  });
});
