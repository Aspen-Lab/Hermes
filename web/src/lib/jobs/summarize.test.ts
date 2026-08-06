import { describe, expect, it } from "vitest";
import { highlightSegments, summarizeJob } from "./summarize";

const REAL_POSTING_FIXTURES = [
  {
    name: "Workada — Data Labeling Specialists",
    terms: ["labeled data", "quality"],
    description:
      "Workada creates high-quality labeled data for advanced technology systems. Our team reviews, organizes, categorizes, evaluates, and quality-checks digital content so those systems can better understand information and perform real-world tasks. We believe careful data work matters. We're hiring detail-oriented individuals who are comfortable working on a computer and interested in careful, focused digital work.",
  },
  {
    name: "Outsite — Business Development Representative",
    terms: ["outbound sales", "remote"],
    description:
      "Outsite is a global coliving company for remote workers, offering extended-stay flexibility and a built-in community. Role Overview: We're hiring a Business Development Representative to build and run outbound sales for Outsite for Teams. You'll identify and prospect the right companies, run discovery calls, and close new business. This is a highly autonomous, build-it-yourself role where you'll help shape the outbound playbook.",
  },
  {
    name: "TELUS Digital — Online Data Analyst",
    terms: ["research", "digital maps"],
    description:
      "This freelance opportunity allows you to work at your own pace and from the comfort of your own home. In this role, you will enhance the content and quality of digital maps used by millions of people worldwide. You will complete research and evaluation tasks such as verifying and comparing data and determining the relevance and accuracy of information. Equal Opportunity: All qualified applicants will receive consideration without regard to race, color, religion, sex, national origin, disability, or protected veteran status.",
  },
] as const;

describe("summarizeJob", () => {
  it.each(REAL_POSTING_FIXTURES)(
    "extracts a compact, useful summary from $name",
    ({ description, terms }) => {
      const summary = summarizeJob(description, [...terms]);
      expect(summary).not.toBe("");
      expect(summary.length).toBeLessThanOrEqual(240);
      expect(summary).not.toMatch(/equal opportunity|without regard to/i);
    },
  );

  it("returns selected sentences in their original order", () => {
    const description =
      "This role supports a growing engineering organization across several product lines. You will build battery models for production research teams. You will analyze solid-state battery experiments and share the results.";
    const summary = summarizeJob(description, ["battery", "solid-state battery"]);

    expect(summary.indexOf("build battery models")).toBeLessThan(
      summary.indexOf("analyze solid-state battery"),
    );
  });

  it("returns an empty string when no sentence survives", () => {
    expect(summarizeJob("", ["battery"])).toBe("");
    expect(summarizeJob("Too short.", ["battery"])).toBe("");
    expect(
      summarizeJob(
        "Equal opportunity employer. Apply now by submitting your application.",
        ["battery"],
      ),
    ).toBe("");
  });

  // B4-04 (round 4): a run of concatenated ATS form-field labels ("Apply to
  // job Employment type: Full time Experience required: ...") had no guard
  // at all and could win a high enough score to be selected — R4's own
  // repro, paraphrased here rather than reproduced verbatim.
  it("rejects a run of scraped ATS labels while keeping a genuine sentence", () => {
    const description =
      "Apply to job Employment type: Full time Experience required: Entry level Location: Remote. " +
      "You will research solid-state battery materials and support daily electrochemistry experiments.";
    const summary = summarizeJob(description, ["battery", "electrochemistry"]);
    expect(summary).not.toMatch(/Employment type:/);
    expect(summary).toBe(
      "You will research solid-state battery materials and support daily electrochemistry experiments.",
    );
  });

  it("returns an empty string when the whole description is scraped chrome", () => {
    const description =
      "Apply to job Employment type: Full time Experience required: Entry level Location: Remote.";
    expect(summarizeJob(description, ["battery"])).toBe("");
  });

  it("still credits a single label as a genuine sentence opener, not chrome", () => {
    // Same shape SECTION_RE already rewards — a rule that rejected any
    // single "Label:" opener would break this real, already-working case.
    const { description, terms } = REAL_POSTING_FIXTURES[1];
    const summary = summarizeJob(description, [...terms]);
    expect(summary).toContain("Role Overview");
  });
});

describe("highlightSegments", () => {
  it("round-trips the input exactly and matches longest terms first", () => {
    const text = "Solid-state battery research improves the battery.";
    const segments = highlightSegments(text, ["battery", "solid-state battery"]);

    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(segments[0]).toEqual({ text: "Solid-state battery", matched: true });
    expect(segments.filter((segment) => segment.matched)).toHaveLength(2);
  });

  it("matches case-insensitively with whole-word-ish boundaries", () => {
    const segments = highlightSegments("Battery work differs from batteries.", ["battery"]);

    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      "Battery",
    ]);
  });

  it("escapes regex punctuation in topic terms", () => {
    const text = "Use C++ for analysis (advanced), not C alone.";
    const segments = highlightSegments(text, ["C++", "(advanced)"]);

    expect(segments.map((segment) => segment.text).join("")).toBe(text);
    expect(segments.filter((segment) => segment.matched).map((segment) => segment.text)).toEqual([
      "C++",
      "(advanced)",
    ]);
  });

  it("merges overlapping matches", () => {
    expect(highlightSegments("battery storage", ["battery", "battery storage"])).toEqual([
      { text: "battery storage", matched: true },
    ]);
  });

  it("returns one unmatched segment for empty terms or no matches", () => {
    expect(highlightSegments("plain text", [])).toEqual([{ text: "plain text", matched: false }]);
    expect(highlightSegments("plain text", ["battery"])).toEqual([
      { text: "plain text", matched: false },
    ]);
  });
});
