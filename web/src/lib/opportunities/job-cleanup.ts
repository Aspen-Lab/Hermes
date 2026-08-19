const JOB_CALL_TO_ACTION_RE =
  /^(?:apply(?:\s+(?:now|today|here))?|learn\s+more|read\s+more|view(?:\s+(?:job|position|posting))?|see\s+(?:details|posting)|job\s+details)[.!]*$/i;

function stripUnbalancedBrackets(value: string): string {
  const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const opening = new Set(Object.keys(pairs));
  const closing = new Set(Object.values(pairs));
  const stack: Array<{ character: string; index: number }> = [];
  const remove = new Set<number>();

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (opening.has(character)) {
      stack.push({ character, index });
      continue;
    }
    if (!closing.has(character)) continue;
    const candidate = stack.at(-1);
    if (candidate && pairs[candidate.character] === character) {
      stack.pop();
    } else {
      remove.add(index);
    }
  }
  for (const unmatched of stack) remove.add(unmatched.index);

  return Array.from(value, (character, index) =>
    remove.has(index) ? "" : character,
  ).join("");
}

function cleanJobText(value: string | null | undefined): string {
  return stripUnbalancedBrackets(value ?? "")
    .replace(/^[\s\u2026.·•|/\\:;-]+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanJobTitle(value: string | null | undefined): string {
  return cleanJobText(value);
}

export function cleanJobSubtitlePart(
  value: string | null | undefined,
): string | undefined {
  const cleaned = cleanJobText(value);
  return cleaned && !JOB_CALL_TO_ACTION_RE.test(cleaned) ? cleaned : undefined;
}

/**
 * B9-03 (round 9): a single leftover punctuation character standing alone
 * where a Markdown link's visible text, or a bullet/colon, was stripped
 * upstream before this text ever reached the app — surviving as its own
 * isolated "word" surrounded by whitespace. Two live-confirmed shapes,
 * handled by one narrow rule rather than two separate patches, per this
 * loop's own "same underlying formatting-strip-artifact class" framing:
 *
 *  - A Markdown-link remnant — `"...protocols. ] and biophysical..."` — a
 *    bare `]` with nothing before it to close within this same sentence.
 *    `stripUnbalancedBrackets` above does not reliably catch this: across a
 *    long, real description it can find some OTHER, unrelated `[` earlier
 *    in the text and treat the two as a valid pair, leaving both alone —
 *    confirmed directly (a short isolated test string strips cleanly; nothing
 *    here claims the longer, real-world case does). No legitimate English
 *    prose uses a bare, space-surrounded `]`, so this rule is unconditional.
 *  - A dash where a bullet/colon/connector most likely stood in the source
 *    markup — `"...understanding of – charge transfer..."` (`www.aiu.edu`).
 *    Unlike the bracket, a dash DOES have a legitimate space-surrounded use
 *    (a real parenthetical aside — "equipment — and rare access — for..."),
 *    so this rule is conditional: only a dash immediately preceded by a
 *    short, closed list of prepositions strips, because standard English
 *    prose does not open a parenthetical dash directly after a bare
 *    preposition — a real parenthetical follows a complete phrase or
 *    clause, not a dangling "of"/"to"/"for". Verified by hand before
 *    writing any test (throwaway probe, deleted before commit): the
 *    aiu.edu-shaped sentence strips to "...understanding of charge
 *    transfer..." (still fully grammatical), while a genuine double-em-dash
 *    parenthetical is left untouched because neither of its dashes follows
 *    one of these prepositions.
 *
 * Scoped to `cleanJobDescription` specifically, NOT the shared
 * `cleanJobText`/`cleanJobSubtitlePart` used for the title/company/location
 * path — company and location strings have no evidence of either shape, and
 * folding this into the shared function would widen the blast radius for no
 * proven benefit (B's own guide flagged this exact risk).
 */
const ISOLATED_BRACKET_REMNANT_RE = /\s+\]\s+/g;
const ORPHANED_DASH_AFTER_PREPOSITION_RE =
  /\b(of|to|in|on|for|with|as|by|from|about|into|onto|at)\s+[–—]\s+/gi;

function stripOrphanedFormattingArtifacts(value: string): string {
  return value
    .replace(ISOLATED_BRACKET_REMNANT_RE, " ")
    .replace(ORPHANED_DASH_AFTER_PREPOSITION_RE, "$1 ")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanJobDescription(
  value: string | null | undefined,
): string {
  return stripOrphanedFormattingArtifacts(cleanJobText(value));
}
