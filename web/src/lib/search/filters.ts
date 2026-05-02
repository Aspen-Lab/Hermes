// Search filter model. Lives in the URL so deep-links restore state.
//
// Reserved URL params (see page.tsx): q, year, from, to, sort, oa, cites, src, venue

export type YearPreset = "any" | "1y" | "5y" | "custom";
export type SortKey = "relevance" | "cited" | "newest";
export type MinCites = 0 | 10 | 50 | 100;
export type SourceType = "arxiv" | "journal" | "conference";

export interface YearFilter {
  preset: YearPreset;
  /** Inclusive lower bound, only meaningful when preset === "custom". */
  from?: number;
  /** Inclusive upper bound, only meaningful when preset === "custom". */
  to?: number;
}

export interface Filters {
  year: YearFilter;
  sort: SortKey;
  oa: boolean;
  minCites: MinCites;
  sources: SourceType[];
  /** Free-text "venue contains" query. Empty string when unset. */
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

const VALID_YEAR_PRESETS: YearPreset[] = ["any", "1y", "5y", "custom"];
const VALID_SORTS: SortKey[] = ["relevance", "cited", "newest"];
const VALID_CITES: MinCites[] = [0, 10, 50, 100];
const VALID_SOURCES: SourceType[] = ["arxiv", "journal", "conference"];

function parseYear(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = parseInt(value, 10);
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return undefined;
  return n;
}

export function filtersFromUrlParams(
  params: URLSearchParams | null,
): Filters {
  if (!params) return cloneDefaults();
  const yearRaw = params.get("year") as YearPreset | null;
  const yearPreset =
    yearRaw && VALID_YEAR_PRESETS.includes(yearRaw) ? yearRaw : "any";

  const sortRaw = params.get("sort") as SortKey | null;
  const sort =
    sortRaw && VALID_SORTS.includes(sortRaw) ? sortRaw : "relevance";

  const citesRaw = parseInt(params.get("cites") ?? "0", 10);
  const minCites = (VALID_CITES.includes(citesRaw as MinCites)
    ? citesRaw
    : 0) as MinCites;

  const srcRaw = (params.get("src") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is SourceType => VALID_SOURCES.includes(s as SourceType));

  return {
    year: {
      preset: yearPreset,
      from: parseYear(params.get("from")),
      to: parseYear(params.get("to")),
    },
    sort,
    oa: params.get("oa") === "1",
    minCites,
    sources: srcRaw,
    venue: params.get("venue") ?? "",
  };
}

export function filtersToUrlParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.year.preset !== "any") p.set("year", f.year.preset);
  if (f.year.preset === "custom") {
    if (f.year.from != null) p.set("from", String(f.year.from));
    if (f.year.to != null) p.set("to", String(f.year.to));
  }
  if (f.sort !== "relevance") p.set("sort", f.sort);
  if (f.oa) p.set("oa", "1");
  if (f.minCites > 0) p.set("cites", String(f.minCites));
  if (f.sources.length > 0) p.set("src", f.sources.join(","));
  if (f.venue.trim()) p.set("venue", f.venue.trim());
  return p;
}

/**
 * Translates the filter state into OpenAlex-friendly query params.
 * Today the search API doesn't honor most of these — it's a forward-
 * compatible hook so we can wire each filter through one at a time.
 */
export function filtersToApiQuery(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.sort === "cited") p.set("sort", "cited_by_count:desc");
  if (f.sort === "newest") p.set("sort", "publication_date:desc");

  const filterParts: string[] = [];
  const yearRange = resolveYearRange(f.year);
  if (yearRange) {
    filterParts.push(`publication_year:${yearRange.from}-${yearRange.to}`);
  }
  if (f.oa) filterParts.push("open_access.is_oa:true");
  if (f.minCites > 0) filterParts.push(`cited_by_count:>${f.minCites}`);
  if (filterParts.length > 0) p.set("filter", filterParts.join(","));
  return p;
}

export function isDefaultFilters(f: Filters): boolean {
  return (
    f.year.preset === "any" &&
    f.year.from == null &&
    f.year.to == null &&
    f.sort === "relevance" &&
    !f.oa &&
    f.minCites === 0 &&
    f.sources.length === 0 &&
    f.venue.trim() === ""
  );
}

function cloneDefaults(): Filters {
  return {
    year: { preset: "any" },
    sort: "relevance",
    oa: false,
    minCites: 0,
    sources: [],
    venue: "",
  };
}

function resolveYearRange(
  y: YearFilter,
): { from: number; to: number } | null {
  const now = new Date().getFullYear();
  switch (y.preset) {
    case "any":
      return null;
    case "1y":
      return { from: now - 1, to: now };
    case "5y":
      return { from: now - 5, to: now };
    case "custom": {
      const from = y.from ?? 1900;
      const to = y.to ?? now;
      if (from > to) return null;
      return { from, to };
    }
  }
}
