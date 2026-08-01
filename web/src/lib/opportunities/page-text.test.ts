import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractPageText,
  findProgrammePageUrl,
  fetchPageText,
  MAX_PAGE_TEXT_CHARS,
} from "./page-text";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("extractPageText", () => {
  it("caps a 300 KB page at a complete paragraph boundary", async () => {
    const paragraphs = Array.from({ length: 660 }, (_, index) => {
      const id = String(index).padStart(4, "0");
      const body = "detail  ".repeat(55).trim();
      return `<p>Paragraph ${id} ${body} END-${id}</p>`;
    });
    const html = `
      <header>HEADER_SENTINEL</header>
      <nav>NAV_SENTINEL</nav>
      <script>SCRIPT_SENTINEL</script>
      <main>${paragraphs.join("")}</main>
      <footer>FOOTER_SENTINEL</footer>
    `;
    expect(html.length).toBeGreaterThan(300 * 1024);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(html, { status: 200 })),
    );

    const text = await fetchPageText("https://events.example.com/programme");

    expect(MAX_PAGE_TEXT_CHARS).toBe(40_000);
    expect(text).not.toBeNull();
    expect(text!.length).toBeLessThanOrEqual(MAX_PAGE_TEXT_CHARS);
    expect(text!.length).toBeGreaterThan(39_000);
    expect(text).toMatch(/END-\d{4}$/);
    expect(text).not.toMatch(/[ \t]{2,}/);
    expect(text).not.toContain("HEADER_SENTINEL");
    expect(text).not.toContain("NAV_SENTINEL");
    expect(text).not.toContain("FOOTER_SENTINEL");
    expect(text).not.toContain("SCRIPT_SENTINEL");
  });

  it("drops hidden and page-furniture regions while preserving paragraphs", () => {
    expect(
      extractPageText(`
        <header>Register Menu</header>
        <nav>Programme navigation</nav>
        <div class="breadcrumb">Home / Events</div>
        <main>
          <h1>Battery Science Congress</h1>
          <p>The first paragraph has irregular     spacing.</p>
          <p>The second paragraph names the closing plenary.</p>
        </main>
        <aside>Related links</aside>
        <footer>Privacy policy</footer>
      `),
    ).toBe(
      "Battery Science Congress\n\nThe first paragraph has irregular spacing.\n\nThe second paragraph names the closing plenary.",
    );
  });

  it("returns null for JavaScript shells", () => {
    expect(
      extractPageText(
        `<html><head><title>Conference</title><script>${"a".repeat(6 * 1024)}</script></head>` +
          `<body><div id="root"></div></body></html>`,
      ),
    ).toBeNull();
    expect(
      extractPageText(
        "<html><body><noscript>Please enable JavaScript to run this app.</noscript></body></html>",
      ),
    ).toBeNull();
  });

  it("never cuts inside a paragraph or exceeds the hard ceiling", () => {
    const oversized = `<p>${"complete words ".repeat(4_000)}</p>`;

    expect(extractPageText(oversized)).toBeNull();
    expect(
      extractPageText(
        `<p>${"first paragraph ".repeat(1_000)}</p><p>${"second paragraph ".repeat(1_000)}</p>`,
        100_000,
      )!.length,
    ).toBeLessThanOrEqual(MAX_PAGE_TEXT_CHARS);
  });
});

describe("fetchPageText", () => {
  it("returns null instead of throwing when the fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));

    await expect(
      fetchPageText("https://events.example.com/programme"),
    ).resolves.toBeNull();
  });
});

describe("findProgrammePageUrl", () => {
  it("returns the best single same-host programme link", () => {
    expect(
      findProgrammePageUrl(
        `
          <a href="#programme">Programme on this page</a>
          <a href="/2027/speakers">Speakers</a>
          <a href="/news">Programme announcement</a>
          <a href="../programme/full-schedule?view=all#day-one">
            <strong>Full scientific programme</strong>
          </a>
          <a href="/2027/schedule">Schedule</a>
        `,
        "https://conference.example.org/2027/home",
      ),
    ).toBe(
      "https://conference.example.org/programme/full-schedule?view=all",
    );
  });

  it("returns null when the only programme link is off-host", () => {
    expect(
      findProgrammePageUrl(
        `
          <a href="https://programme.example.net/full">Programme</a>
          <a href="//cdn.example.net/schedule">Schedule</a>
        `,
        "https://conference.example.org/2027/home",
      ),
    ).toBeNull();
  });

  it("returns null when there are no programme candidates", () => {
    expect(
      findProgrammePageUrl(
        `
          <!-- <a href="/programme">Hidden programme</a> -->
          <script>const link = '<a href="/schedule">Schedule</a>';</script>
          <template><a href="/agenda">Agenda</a></template>
          <a href="/registration">Registration</a>
          <a href="news">Programming committee update</a>
          <a href="/programme.pdf">Download programme PDF</a>
          <a href="mailto:team@example.org">Contact</a>
          <a href="javascript:void(0)">Open menu</a>
        `,
        "https://conference.example.org/programme/2027/home",
      ),
    ).toBeNull();
  });
});
