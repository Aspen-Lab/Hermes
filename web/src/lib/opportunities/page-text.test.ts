import { afterEach, describe, expect, it, vi } from "vitest";
import {
  annotatePageHeadings,
  extractPageHeadings,
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

  it("keeps programme content inside a session-header container", () => {
    const html = `
      <main>
        <div class="site-header"><h2>Account Navigation</h2></div>
        <header class="session-header">
          <h3>Materials Informatics-Guided Design of Battery Materials</h3>
        </header>
        <div class="session-header">
          <h3>Interface Stability in Solid-State Cells</h3>
        </div>
        <p>A source-backed abstract.</p>
      </main>
    `;

    const text = extractPageText(html);
    const headings = extractPageHeadings(html);
    expect(text).toContain(
      "Materials Informatics-Guided Design of Battery Materials",
    );
    expect(text).toContain("Interface Stability in Solid-State Cells");
    expect(text).not.toContain("Account Navigation");
    expect(headings).toContainEqual({
      level: 3,
      text: "Materials Informatics-Guided Design of Battery Materials",
    });
    expect(headings).toContainEqual({
      level: 3,
      text: "Interface Stability in Solid-State Cells",
    });
    expect(headings).not.toContainEqual({
      level: 2,
      text: "Account Navigation",
    });
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

describe("extractPageHeadings", () => {
  it("keeps exact visible heading text with level context and drops furniture", () => {
    expect(
      extractPageHeadings(`
        <header><h2>Navigation heading</h2></header>
        <main>
          <h2>Battery Interfaces</h2>
          <h3>Materials <em>Informatics-Guided</em> Design</h3>
          <h3>Materials Informatics-Guided Design</h3>
          <p>This abstract is not a heading.</p>
        </main>
        <footer><h3>Privacy</h3></footer>
      `),
    ).toEqual([
      { level: 2, text: "Battery Interfaces" },
      { level: 3, text: "Materials Informatics-Guided Design" },
    ]);
  });
});

describe("annotatePageHeadings", () => {
  it("marks retained source headings inside the same 40,000-character text budget", () => {
    const title = "Materials Informatics-Guided Design of Battery Materials";
    const rawText = `09:00 ${title} Speaker Name\n\n${"source detail ".repeat(4_000)}`;
    const result = annotatePageHeadings(rawText, [{ level: 3, text: title }]);

    expect(result.text).not.toBeNull();
    expect(result.text!.length).toBeLessThanOrEqual(MAX_PAGE_TEXT_CHARS);
    expect(result.text).toContain(`[PROGRAMME HEADING LEVEL 3] ${title}`);
    expect(result.text).toContain("09:00");
    expect(result.text).toContain("Speaker Name");
    expect(result.text!.match(new RegExp(title, "g"))).toHaveLength(1);
    expect(result.headings).toEqual([{ level: 3, text: title }]);
  });

  it("does not advertise a heading beyond the retained source-text cap", () => {
    const title = "Battery Interface Study";
    const html = `<p>${"x".repeat(39_990)}</p><h3>${title}</h3>`;
    const cappedText = extractPageText(html);
    const result = annotatePageHeadings(
      cappedText!,
      extractPageHeadings(html),
    );

    expect(cappedText).not.toContain(title);
    expect(result.text).toBe(cappedText);
    expect(result.headings).toEqual([]);
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
          <a href="/single-session">Session</a>
          <a href="/invited-talk">Talk</a>
          <a href="/keynote-speaker">Speaker</a>
          <a href="mailto:team@example.org">Contact</a>
          <a href="javascript:void(0)">Open menu</a>
        `,
        "https://conference.example.org/programme/2027/home",
      ),
    ).toBeNull();
  });

  it("uses explicit href fragments but never returns a same-document link", () => {
    expect(
      findProgrammePageUrl(
        `
          <a href="http://conference.example.org/2027/home#agenda">Agenda</a>
          <a href="/2027/day-one#sessions"><span aria-label="Calendar"></span></a>
        `,
        "https://conference.example.org/2027/home",
      ),
    ).toBe("https://conference.example.org/2027/day-one");
  });
});

describe("programme entries outside heading tags", () => {
  // The IAEA record for "Ion exchange processes: advances and applications"
  // lists its eight contributions as sidebar links. Searching only h1-h6 found
  // none of them and the report said it could quote no talk titles at all.
  const iaeaSidebar = `
    <main>
      <h2>Individual Papers/Chapters</h2>
      <ul>
        <li><a href="/1" title="The removal and solidification of radioactive waste">The removal and solidification of rad…</a></li>
        <li><a href="/2">Ion exchange in the nuclear power industry</a></li>
        <li><a href="/3">Fundamentals of ion exchange</a></li>
        <li><a href="/4">Improving amine breakthrough predicti…</a></li>
      </ul>
    </main>`;

  it("finds titles in a list, not only in headings", () => {
    const texts = extractPageHeadings(iaeaSidebar).map((h) => h.text);
    expect(texts).toContain("Ion exchange in the nuclear power industry");
    expect(texts).toContain("Fundamentals of ion exchange");
  });

  it("recovers a truncated title from the markup rather than publishing half of one", () => {
    const texts = extractPageHeadings(iaeaSidebar).map((h) => h.text);
    expect(texts).toContain(
      "The removal and solidification of radioactive waste",
    );
    expect(texts.some((t) => t.includes("…"))).toBe(false);
  });

  it("drops a truncated title with no recoverable full text", () => {
    const texts = extractPageHeadings(iaeaSidebar).map((h) => h.text);
    expect(texts.some((t) => t.startsWith("Improving amine"))).toBe(false);
  });

  it("finds session titles in a programme table", () => {
    const texts = extractPageHeadings(`
      <main><table><tr>
        <td>09:00</td><td>Solid-state electrolytes for fast-charging cells</td>
      </tr></table></main>`).map((h) => h.text);
    expect(texts).toContain("Solid-state electrolytes for fast-charging cells");
  });

  it("ignores bare labels and nav rows", () => {
    const texts = extractPageHeadings(`
      <nav><ul><li><a href="/programme">Programme</a></li></ul></nav>
      <main><ul><li>Sponsors</li><li>Home</li></ul></main>`).map((h) => h.text);
    expect(texts).not.toContain("Programme");
    expect(texts).not.toContain("Sponsors");
    expect(texts).not.toContain("Home");
  });
});
