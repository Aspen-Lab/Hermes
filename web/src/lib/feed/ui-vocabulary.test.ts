import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MODEL_WRITTEN_BADGE,
  NO_MODEL_BADGE,
} from "@/components/reports/report-badge";

/**
 * ABC-freemium 1-27 · R-UI-1, D6.
 *
 * **A's scan 1, turned from a grep into a gate — and this is the highest-value
 * test in unit (g).** R-UI-1 is the one requirement in the spec that a future
 * edit can silently reopen: a new component with `Tier 2` in it breaks nothing,
 * fails nothing, and is invisible until someone runs the scan by hand.
 *
 * The filter is A's own: skip test files, and drop lines whose first non-space
 * characters are a line or block comment marker.
 */

const BANNED = /Tier [012]|BYOK/;

/**
 * The four A hand-excluded, each with the reason it is exempt. **All four are
 * unrendered**: three are inside JSX comment blocks, whose inner lines do not
 * begin with a comment marker and so survive the mechanical filter, and one is
 * a `console.warn`.
 *
 * Matched **by text, never by line number** — a comment added anywhere above
 * would shift a pinned number, which turns a gate into a maintenance nuisance
 * and invites the next reader to loosen it.
 *
 * Adding an entry here is a decision, not a formality: it must be a string the
 * reader can never see.
 */
const ALLOWED: ReadonlyArray<{ file: string; text: string; why: string }> = [
  {
    file: "src/app/jobs/[id]/page.tsx",
    text: "the POSTING's own prose (Tier 0). Ruling 111b",
    why: "Inside a JSX comment describing the plate's provenance rule. Not rendered.",
  },
  {
    file: "src/app/jobs/[id]/page.tsx",
    text: "the plate shows a substantive Tier 0 paragraph.",
    why: "Inside a JSX comment. Not rendered.",
  },
  {
    file: "src/app/page.tsx",
    text: 'showed "Tier 0" while jobs and events ran Tier 2.',
    why: "Inside a JSX comment recording the chip defect Ruling 68a fixed. Not rendered.",
  },
  {
    file: "src/lib/feed/tier2-rerank.ts",
    text: "rerank failed, keeping Tier 1 order",
    why: "A console.warn on the rerank's failure path. Server log, never a rendered string.",
  },
];

interface Hit {
  file: string;
  line: number;
  text: string;
}

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...sourceFiles(full));
      continue;
    }
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

/** A's own mechanical filter. */
function isComment(line: string): boolean {
  const trimmed = line.trimStart();
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*")
  );
}

function toPosix(file: string): string {
  return path.relative(process.cwd(), file).split(path.sep).join("/");
}

function survivors(): Hit[] {
  const found: Hit[] = [];
  for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
    const rel = toPosix(file);
    const lines = fs.readFileSync(file, "utf8").split("\n");
    lines.forEach((line, index) => {
      if (isComment(line) || !BANNED.test(line)) return;
      found.push({ file: rel, line: index + 1, text: line.trim() });
    });
  }
  return found;
}

function isAllowed(hit: Hit): boolean {
  return ALLOWED.some(
    (entry) => entry.file === hit.file && hit.text.includes(entry.text),
  );
}

describe("no rendered string carries the tier vocabulary (R-UI-1, D6)", () => {
  it("has nothing outside the four unrendered exclusions", () => {
    const unexpected = survivors()
      .filter((hit) => !isAllowed(hit))
      .map((hit) => `${hit.file}:${hit.line} ${hit.text}`)
      .sort();

    expect(unexpected).toEqual([]);
  });

  it("keeps the exclusion list honest — every entry still matches", () => {
    // Without this, an entry cleaned up long ago sits here forever and quietly
    // re-authorises that exact line if the vocabulary comes back to it.
    const found = survivors();
    for (const entry of ALLOWED) {
      expect(
        found.some(
          (hit) => hit.file === entry.file && hit.text.includes(entry.text),
        ),
        `${entry.file} no longer contains the excluded line: ${entry.text}`,
      ).toBe(true);
    }
  });

  it("uses one shared provenance label, not seven synonyms", () => {
    // D6 asks for a plain-language label on the badges that mean "computed
    // without a model". Seven near-synonyms would be worse than the tier number
    // they replaced, so the constant is asserted to be what is actually used.
    expect(NO_MODEL_BADGE).toBe("No model used");
    expect(MODEL_WRITTEN_BADGE).toBe("AI written");

    const retyped: string[] = [];
    for (const file of sourceFiles(path.join(process.cwd(), "src"))) {
      if (file.endsWith("report-badge.tsx")) continue;
      const source = fs.readFileSync(file, "utf8");
      if (source.includes(`>${NO_MODEL_BADGE}<`)) retyped.push(toPosix(file));
    }

    expect(retyped).toEqual([]);
  });
});
