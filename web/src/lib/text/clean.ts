const HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "-",
  mdash: "-",
  minus: "-",
  hellip: "...",
  rsquo: "'",
  lsquo: "'",
  rdquo: '"',
  ldquo: '"',
  times: "x",
  plusmn: "+/-",
  le: "<=",
  ge: ">=",
  micro: "micro",
  deg: " degrees",
};

const SUBSCRIPT_MAP: Record<string, string> = {
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "+": "+",
  "-": "-",
  "=": "=",
  "(": "(",
  ")": ")",
  "₀": "0",
  "₁": "1",
  "₂": "2",
  "₃": "3",
  "₄": "4",
  "₅": "5",
  "₆": "6",
  "₇": "7",
  "₈": "8",
  "₉": "9",
  "₊": "+",
  "₋": "-",
  "₌": "=",
  "₍": "(",
  "₎": ")",
};

const SUPERSCRIPT_MAP: Record<string, string> = {
  "0": "0",
  "1": "1",
  "2": "2",
  "3": "3",
  "4": "4",
  "5": "5",
  "6": "6",
  "7": "7",
  "8": "8",
  "9": "9",
  "+": "+",
  "-": "-",
  "=": "=",
  "(": "(",
  ")": ")",
  "⁰": "0",
  "¹": "1",
  "²": "2",
  "³": "3",
  "⁴": "4",
  "⁵": "5",
  "⁶": "6",
  "⁷": "7",
  "⁸": "8",
  "⁹": "9",
  "⁺": "+",
  "⁻": "-",
  "⁼": "=",
  "⁽": "(",
  "⁾": ")",
};

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h: string) =>
      String.fromCodePoint(parseInt(h, 16)),
    )
    .replace(/&#(\d+);/g, (_, d: string) =>
      String.fromCodePoint(parseInt(d, 10)),
    )
    .replace(/&([a-zA-Z][a-zA-Z0-9]+);/g, (entity, name: string) =>
      HTML_ENTITIES[name] ?? entity,
    );
}

function stripHtmlTags(text: string): string {
  return text
    .replace(/<\/?(p|br|div|section|article|li|ul|ol|jats:[a-z0-9-]+)\b[^>]*>/gi, "\n")
    .replace(/<\/?(?:sub|sup|i|em|b|strong|span|mml:[^>\s]+)\b[^>]*>/gi, "")
    .replace(/<\/?[A-Za-z][A-Za-z0-9:-]{1,}\b[^>]*>/g, " ");
}

function normalizeLatex(text: string): string {
  return text
    .replace(/\$_\{([^}]*)\}\$/g, (_, s: string) => toPlainSubscript(s))
    .replace(/\$\^\{([^}]*)\}\$/g, (_, s: string) => `(${s})`)
    .replace(/_\{([^}]*)\}/g, "$1")
    .replace(/\^\{([^}]*)\}/g, "($1)")
    .replace(/_([A-Za-z0-9+\-=()]+)/g, "$1")
    .replace(/\^([A-Za-z0-9+\-=()]+)/g, "($1)")
    .replace(/\$([^$\n]+)\$/g, "$1")
    .replace(/\\(?:text|mathrm|mathbf|mathit|rm)\{([^}]*)\}/g, "$1")
    .replace(/\\alpha\b/g, "alpha")
    .replace(/\\beta\b/g, "beta")
    .replace(/\\gamma\b/g, "gamma")
    .replace(/\\delta\b/g, "delta")
    .replace(/\\mu\b/g, "micro")
    .replace(/\\sigma\b/g, "sigma")
    .replace(/\\rightarrow\b/g, "->")
    .replace(/\\leftarrow\b/g, "<-")
    .replace(/\\times\b/g, "x")
    .replace(/\\pm\b/g, "+/-")
    .replace(/\\cdot\b/g, ".")
    .replace(/[{}]/g, "");
}

function toPlainSubscript(text: string): string {
  return text.split("").map((c) => SUBSCRIPT_MAP[c] ?? c).join("");
}

function normalizeUnicodeSymbols(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—―−]/g, "-")
    .replace(/×/g, "x")
    .replace(/±/g, "+/-")
    .replace(/≤/g, "<=")
    .replace(/≥/g, ">=")
    .replace(/µ/g, "micro")
    .replace(/°/g, " degrees")
    .replace(/[₀₁₂₃₄₅₆₇₈₉₊₋₌₍₎]/g, (c) => SUBSCRIPT_MAP[c] ?? c)
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻⁼⁽⁾]/g, (c) => SUPERSCRIPT_MAP[c] ?? c);
}

function repairCommonMojibake(text: string): string {
  return text
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ/g, '"')
    .replace(/â€�/g, '"')
    .replace(/â€“|â€”|â€"/g, "-")
    .replace(/â€¦/g, "...")
    .replace(/â†’/g, "->")
    .replace(/â†\u0090/g, "<-")
    .replace(/Â°/g, " degrees")
    .replace(/Â±/g, "+/-")
    .replace(/Â·/g, ".")
    .replace(/Â/g, "");
}

function normalizeChemistryAndOperators(text: string): string {
  return text
    .replace(/\b([A-Z][a-z]?)\s+([a-z](?=[A-Z]))/g, "$1$2")
    .replace(/([A-Z])\s+(\d)(?=\b|[A-Z),.:;])/g, "$1$2")
    .replace(/\s*([<>]=?|=)\s*/g, " $1 ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1");
}

export function cleanDisplayText(text: string | null | undefined): string {
  if (!text) return "";
  return normalizeChemistryAndOperators(
    normalizeUnicodeSymbols(
      normalizeLatex(stripHtmlTags(decodeHtmlEntities(stripHtmlTags(repairCommonMojibake(text))))),
    ),
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function cleanDisplayTextOrUndefined(
  text: string | null | undefined,
): string | undefined {
  const cleaned = cleanDisplayText(text);
  return cleaned || undefined;
}
