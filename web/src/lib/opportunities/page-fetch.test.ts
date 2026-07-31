import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import {
  fetchPageHtml,
  fetchPagesConcurrently,
  UNFETCHABLE_HOSTS,
} from "./page-fetch";

function usableHtml(content: string): string {
  return `${content}<main>${"Opportunity detail text. ".repeat(1_000)}</main>`;
}

describe("fetchPageHtml", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches HTML with the detail-page request contract", async () => {
    const html = usableHtml("<html><title>Battery Summit</title></html>");
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(html, {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPageHtml("https://events.example.com/summit")).resolves.toBe(
      html,
    );

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://events.example.com/summit");
    expect(init).toMatchObject({
      method: "GET",
      redirect: "follow",
      cache: "no-store",
    });
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init.headers).get("accept")).toContain("text/html");
    expect(new Headers(init.headers).get("user-agent")).toContain("PeerBot");
  });

  it("returns null for an unsuccessful response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("Forbidden", { status: 403 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPageHtml("https://events.example.com/private")).resolves.toBeNull();
  });

  it("aborts after 12 seconds and returns null", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = fetchPageHtml("https://events.example.com/slow");
    await vi.advanceTimersByTimeAsync(12_000);

    await expect(result).resolves.toBeNull();
  });

  it("rejects a response whose declared size exceeds 2MB", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response("not read", {
        status: 200,
        headers: { "content-length": String(2 * 1024 * 1024 + 1) },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchPageHtml("https://events.example.com/huge")).resolves.toBeNull();
  });

  it("rejects an oversized streamed response without a content-length header", async () => {
    const tooLarge = new Uint8Array(2 * 1024 * 1024 + 1);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(tooLarge);
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPageHtml("https://events.example.com/streamed-huge"),
    ).resolves.toBeNull();
  });

  it("keeps a nonempty JavaScript shell for tolerant downstream extractors", async () => {
    const shell = `<html><head><script>${"a".repeat(6 * 1024)}</script></head><body><div id="root"></div></body></html>`;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(shell, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPageHtml("https://jobs.example.com/shell"),
    ).resolves.toBe(shell);
  });

  it("keeps a real extractable page smaller than the former 20 KB floor", async () => {
    // Regression guard: opportunity usefulness is not correlated with page
    // size. This lean page contains the exact structured data the pipeline
    // needs and must reach the extractor unchanged.
    const realPage =
      `<script type="application/ld+json">` +
      `{"@type":"Event","location":{"address":{"addressLocality":"Chicago"}}}` +
      `</script><h1>Solid-State Battery Summit</h1>`;
    expect(realPage.length).toBeLessThan(20 * 1024);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(realPage, { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPageHtml("https://careers.example.gov/posting"),
    ).resolves.toBe(realPage);
  });

  it("skips known-unfetchable hosts without making a request", async () => {
    expect(UNFETCHABLE_HOSTS).toContain("10times.com");
    expect(UNFETCHABLE_HOSTS).toContain("battery-tech.net");

    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPageHtml("https://www.10times.com/example"),
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("fetchPagesConcurrently", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("preserves input order while respecting the concurrency limit", async () => {
    let active = 0;
    let peak = 0;
    const fetchMock = vi.fn(async (url: string) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return new Response(usableHtml(`<html>${url}</html>`), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const urls = Array.from(
      { length: 7 },
      (_, index) => `https://events.example.com/${index}`,
    );
    const pages = await fetchPagesConcurrently(urls, 2);

    expect(fetchMock).toHaveBeenCalledTimes(urls.length);
    expect(peak).toBe(2);
    expect(pages).toEqual(
      urls.map((url) => usableHtml(`<html>${url}</html>`)),
    );
  });
});
