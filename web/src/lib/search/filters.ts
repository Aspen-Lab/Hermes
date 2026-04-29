export type YearPreset = "any" | "1y" | "5y" | "custom";
export type SortKey = "relevance" | "cited" | "newest";
export type SourceType = "journal" | "conference" | "arxiv";
export type MinCites = 0 | 10 | 50 | 100;

export interface YearFilter {
  preset: YearPreset;
  from?: number;
  to?: number;
}

export interface Filters {
  year: YearFilter;
  sort: SortKey;
  oa: boolean;
  minCites: MinCites;
  sources: SourceType[];
  venue: string;
}

export const DEFAULT_FILTERS: Filters = {
  year: { preset: "any" },
  sort: "relevance",
  oa: false,
  minCites: 0,
  sources: [],
  venue: "",
};

const VALID_SORT: ReadonlySet<SortKey> = new Set(["relevance", "cited", "newest"]);
const VALID_PRESET: ReadonlySet<YearPreset> = new Set([
  "any",
  "1y",
  "5y",
  "custom",
]);
const VALID_SOURCE: ReadonlySet<SourceType> = new Set([
  "journal",
  "conference",
  "arxiv",
]);
const VALID_CITES: ReadonlySet<number> = new Set([0, 10, 50, 100]);

export function isDefaultFilters(f: Filters): boolean {
  return (
    f.year.preset === "any" &&
    f.sort === "relevance" &&
    f.oa === false &&
    f.minCites === 0 &&
    f.sources.length === 0 &&
    f.venue.trim() === ""
  );
}

export function filtersFromUrlParams(p: URLSearchParams | null): Filters {
  if (!p) return { ...DEFAULT_FILTERS, year: { ...DEFAULT_FILTERS.year } };

  const yearRaw = p.get("year") ?? "any";
  const preset: YearPreset = (VALID_PRESET.has(yearRaw as YearPreset)
    ? yearRaw
    : "any") as YearPreset;
  const fromNum = parseYear(p.get("from"));
  const toNum = parseYear(p.get("to"));

  const sortRaw = p.get("sort") ?? "relevance";
  const sort: SortKey = (VALID_SORT.has(sortRaw as SortKey)
    ? sortRaw
    : "relevance") as SortKey;

  const oa = p.get("oa") === "1";

  const citesRaw = parseInt(p.get("cites") ?? "0", 10);
  const minCites: MinCites = (VALID_CITES.has(citesRaw)
    ? citesRaw
    : 0) as MinCites;

  const srcRaw = (p.get("src") ?? "").split(",").filter(Boolean);
  const sources = srcRaw.filter((s): s is SourceType =>
    VALID_SOURCE.has(s as SourceType),
  );

  const venue = (p.get("venue") ?? "").trim();

  return {
    year: { preset, from: fromNum, to: toNum },
    sort,
    oa,
    minCites,
    sources,
    venue,
  };
}

function parseYear(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return undefined;
  if (n < 1900 || n > 2100) return undefined;
  return n;
}

export function filtersToUrlParams(f: Filters): URLSearchParams {
  const out = new URLSearchParams();
  if (f.year.preset !== "any") out.set("year", f.year.preset);
  if (f.year.preset === "custom") {
    if (f.year.from) out.set("from", String(f.year.from));
    if (f.year.to) out.set("to", String(f.year.to));
  }
  if (f.sort !== "relevance") out.set("sort", f.sort);
  if (f.oa) out.set("oa", "1");
  if (f.minCites > 0) out.set("cites", String(f.minCites));
  if (f.sources.length > 0) out.set("src", f.sources.join(","));
  if (f.venue.trim()) out.set("venue", f.venue.trim());
  return out;
}

export interface ResolvedYearRange {
  from?: number;
  to?: number;
}

export function resolveYearRange(
  year: YearFilter,
  now: Date = new Date(),
): ResolvedYearRange {
  const currentYear = now.getUTCFullYear();
  switch (year.preset) {
    case "any":
      return {};
    case "1y":
      return { from: currentYear - 1 };
    case "5y":
      return { from: currentYear - 4 };
    case "custom":
      return { from: year.from, to: year.to };
  }
}

export function filtersToApiQuery(f: Filters): URLSearchParams {
  const out = new URLSearchParams();
  const range = resolveYearRange(f.year);
  if (range.from) out.set("from", String(range.from));
  if (range.to) out.set("to", String(range.to));
  if (f.sort !== "relevance") out.set("sort", f.sort);
  if (f.oa) out.set("oa", "1");
  if (f.minCites > 0) out.set("cites", String(f.minCites));
  if (f.sources.length > 0) out.set("src", f.sources.join(","));
  if (f.venue.trim()) out.set("venue", f.venue.trim());
  return out;
}
