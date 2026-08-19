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

  it("picks a plural 'Programs' link over a higher-scoring 'agenda' lead-gen link", () => {
    // Round 3 B item 1 (advancedautobat.com witness): the singular-only
    // `program(?:me)?\b` pattern could never match "Programs", so a real
    // same-host programme page sat unscored next to a PDF-gated lead-gen
    // form whose text says "agenda". Widening the pattern to `program(?:me)?s?\b`
    // lets "Programs" score (7 weight, text+href both match: 7*2+7=21),
    // beating the agenda-only link (5 weight, text only: 5*2+0=10) outright.
    expect(
      findProgrammePageUrl(
        `
          <a href="/us/2026-brochure-download-form">View Brochure &amp; Final Agenda</a>
          <a href="/aabc-us/programs">Programs</a>
        `,
        "https://www.advancedautobat.com/us/",
      ),
    ).toBe("https://www.advancedautobat.com/aabc-us/programs");
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

  it("returns null when the only programme-scoring link sits inside sitewide chrome (rsc.org must-drop witness)", () => {
    // F-P2-01 / Round 6 B / Ruling 114: the live rsc.org page picked this
    // exact sitewide-nav link ("Careers talks and events") as an ion-exchange
    // course's programme page, and that wrong page's ChemCareers content
    // bled into talkSummaries. The real markup nests it inside a capitalised
    // `<Nav id="mainnav">` framework component whose class names
    // (`mainnav__link`) do NOT match the furniture keyword regex, but the
    // already-shipped tag-name check matches `<Nav>` case-insensitively —
    // this fixture asserts the fix reaches it and the pick falls to null,
    // the safe failure direction, rather than a wrong-event fill.
    expect(
      findProgrammePageUrl(
        `
          <Nav id="mainnav" class="mainnav" data-ktc-search-exclude>
            <a href="/funding-and-support/careers/career-support/talks-and-events" class="mainnav__link">Careers talks and events</a>
          </Nav>
          <main>
            <h1>IEX 2026</h1>
          </main>
        `,
        "https://www.rsc.org/events/iex-2026",
      ),
    ).toBeNull();
  });

  it("never picks a nav-nested candidate over a lower-scoring non-chrome one (mechanism lock)", () => {
    // Locks the direction of the fix: a nav-nested link that would outscore
    // a real, non-chrome link on keyword weight alone must never win — the
    // chrome filter now runs before scoring even sees the candidate, so a
    // higher raw score inside a <nav> cannot beat a lower one outside it.
    expect(
      findProgrammePageUrl(
        `
          <nav>
            <a href="/programme/agenda">Programme Agenda</a>
          </nav>
          <main>
            <a href="/speakers">Speakers List</a>
          </main>
        `,
        "https://conference.example.org/home",
      ),
    ).toBe("https://conference.example.org/speakers");
  });

  it("keeps a second, non-chrome occurrence of the same link when the first sits in a nav dropdown (advancedautobat.com must-keep witness)", () => {
    // Round 6 B's live corpus: the real advancedautobat.com "Programs"
    // link's FIRST DOM occurrence sits inside a Bootstrap nav-dropdown
    // (`navbar-collapse` > `nav navbar-nav`), which this fix now strips too
    // — but an identical-href second occurrence lives in real page content
    // (an "about-blurb" section) and resolves to the same final answer, so
    // the must-keep pick survives unchanged.
    expect(
      findProgrammePageUrl(
        `
          <nav class="navbar navbar-collapse">
            <ul class="nav navbar-nav">
              <li><a href="/aabc-us/programs">Programs</a></li>
            </ul>
          </nav>
          <main>
            <div class="about-blurb">
              <p>Read more in our <a href="/aabc-us/programs">Programs</a> section.</p>
            </div>
          </main>
        `,
        "https://www.advancedautobat.com/us/",
      ),
    ).toBe("https://www.advancedautobat.com/aabc-us/programs");
  });

  it("leaves a pick with no chrome involved unchanged (euchemsil2026.com must-keep witness)", () => {
    // Round 6 B's live corpus: euchemsil2026.com's programme pick involves
    // no chrome at all, so this fix is a no-op on this shape — named
    // explicitly for traceability to the live specimen, mirroring round
    // 3/4's own live-witness-as-fixture practice.
    expect(
      findProgrammePageUrl(
        `
          <main>
            <a href="/program/">Programme</a>
          </main>
        `,
        "https://www.euchemsil2026.com/",
      ),
    ).toBe("https://www.euchemsil2026.com/program/");
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
