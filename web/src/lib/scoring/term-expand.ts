/**
 * Bidirectional materials/electrochemistry vocabulary. Values are
 * canonicalized before indexing, so punctuation variants such as `li-ion`
 * collapse to the same surface form as `li ion`.
 */
export const ABBREVIATION_GROUPS = [
  ["li ion", "lithium ion", "lithium-ion"],
  ["lco", "lithium cobalt oxide"],
  ["nmc", "nickel manganese cobalt oxide"],
  ["lfp", "lithium iron phosphate"],
  ["ssb", "solid state battery", "all solid state battery"],
  ["se", "solid electrolyte"],
  ["eis", "electrochemical impedance spectroscopy"],
  ["xrd", "x ray diffraction"],
  ["sem", "scanning electron microscopy"],
  ["tem", "transmission electron microscopy"],
  ["xps", "x ray photoelectron spectroscopy"],
  ["dft", "density functional theory"],
  ["cv", "cyclic voltammetry"],
  ["in situ", "in-situ", "operando"],
] as const;

export const GENERIC_TERMS = new Set([
  "materials",
  "energy",
  "transport",
  "modelling",
  "simulation",
  "interface",
  "design",
  "analysis",
  "systems",
  "data",
  "characterization",
]);

/** Canonical form shared by both user terms and item text. */
export function canonicalize(text: string): string {
  return text
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[/_\p{Pd}\u2212]+/gu, " ")
    .replace(/[^\p{L}\p{N}\p{M}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const ABBREVIATION_INDEX = new Map<string, readonly string[]>();
const KNOWN_SHORT_FORMS = new Set<string>();

for (const rawGroup of ABBREVIATION_GROUPS) {
  const group = Array.from(new Set(rawGroup.map(canonicalize).filter(Boolean)));
  for (const form of group) {
    ABBREVIATION_INDEX.set(form, group);
    if (!form.includes(" ") && form.length <= 4) KNOWN_SHORT_FORMS.add(form);
  }
}

const IRREGULAR_INFLECTIONS = new Map<string, string[]>([
  ["battery", ["batteries"]],
  ["batteries", ["battery"]],
  ["matrix", ["matrices"]],
  ["matrices", ["matrix"]],
  ["analysis", ["analyses"]],
  ["analyses", ["analysis"]],
]);

function inflectedForms(phrase: string): string[] {
  const words = phrase.split(" ").filter(Boolean);
  if (words.length === 0) return [];
  const last = words.at(-1)!;
  if (words.length === 1 && KNOWN_SHORT_FORMS.has(last)) return [];

  let variants = IRREGULAR_INFLECTIONS.get(last) ?? [];
  if (variants.length === 0) {
    if (/[^aeiou]y$/u.test(last)) {
      variants = [`${last.slice(0, -1)}ies`];
    } else if (/ies$/u.test(last) && last.length > 3) {
      variants = [`${last.slice(0, -3)}y`];
    } else if (/s$/u.test(last) && last.length > 3) {
      variants = [last.slice(0, -1)];
    } else if (/(?:ch|sh|x|z)$/u.test(last)) {
      variants = [`${last}es`];
    } else {
      variants = [`${last}s`];
    }
  }

  const prefix = words.slice(0, -1);
  return variants.map((variant) => [...prefix, variant].join(" "));
}

/** Canonical, morphological, and abbreviation-equivalent forms for a term. */
export function expandTerm(term: string): string[] {
  const canonical = canonicalize(term);
  if (!canonical) return [];

  const expanded = new Set<string>();
  const queue = [canonical];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (!current || expanded.has(current)) continue;
    expanded.add(current);

    for (const inflected of inflectedForms(current)) {
      if (!expanded.has(inflected)) queue.push(inflected);
    }
    for (const equivalent of ABBREVIATION_INDEX.get(current) ?? []) {
      if (!expanded.has(equivalent)) queue.push(equivalent);
    }
  }
  return Array.from(expanded);
}

const WORD_CHAR = "\\p{L}\\p{N}\\p{M}";
const AMBIGUOUS_PRECEDERS: Readonly<Record<string, ReadonlySet<string>>> = {
  material: new Set(["marketing", "course"]),
  materials: new Set(["marketing", "course"]),
};

function isAllowedOccurrence(
  haystack: string,
  variant: string,
  start: number,
): boolean {
  const deniedPreceders = AMBIGUOUS_PRECEDERS[variant];
  if (!deniedPreceders) return true;
  const before = haystack.slice(0, start).trim();
  const previousWord = before.split(/\s+/u).at(-1) ?? "";
  return !deniedPreceders.has(previousWord);
}

/**
 * Whole-word match against a canonicalized haystack. Call `canonicalize`
 * before invoking directly; scoreKeyword does this once per item.
 */
export function termMatches(canonicalHaystack: string, term: string): boolean {
  for (const variant of expandTerm(term)) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(
      `(?<![${WORD_CHAR}])${escaped}(?![${WORD_CHAR}])`,
      "gu",
    );
    for (const match of canonicalHaystack.matchAll(re)) {
      if (isAllowedOccurrence(canonicalHaystack, variant, match.index)) {
        return true;
      }
    }
  }
  return false;
}

/** Specificity weight used by the saturating keyword score. */
export function termSpecificity(term: string): number {
  const canonical = canonicalize(term);
  if (!canonical) return 0;
  if (GENERIC_TERMS.has(canonical)) return 0.3;
  if (canonical.includes(" ")) return 1;
  if (KNOWN_SHORT_FORMS.has(canonical) || canonical.length >= 8) return 0.7;
  return 0.5;
}
