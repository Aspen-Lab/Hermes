export interface Filters {
  sort: "relevance" | "date" | "citations";
  from: string | null;
  to: string | null;
  oa: boolean;
  cites: number | null;
  src: string | null;
  venue: string | null;
}

export const DEFAULT_FILTERS: Filters = {
  sort: "relevance",
  from: null,
  to: null,
  oa: false,
  cites: null,
  src: null,
  venue: null,
};

export function filtersFromUrlParams(params: URLSearchParams | null): Filters {
  if (!params) return { ...DEFAULT_FILTERS };
  return {
    sort: (["relevance", "date", "citations"].includes(params.get("sort") ?? "")
      ? params.get("sort")
      : DEFAULT_FILTERS.sort) as Filters["sort"],
    from: params.get("from"),
    to: params.get("to"),
    oa: params.get("oa") === "1",
    cites: params.get("cites") ? parseInt(params.get("cites")!, 10) : null,
    src: params.get("src"),
    venue: params.get("venue"),
  };
}

export function filtersToUrlParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.sort !== DEFAULT_FILTERS.sort) p.set("sort", f.sort);
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.oa) p.set("oa", "1");
  if (f.cites != null) p.set("cites", String(f.cites));
  if (f.src) p.set("src", f.src);
  if (f.venue) p.set("venue", f.venue);
  return p;
}

export function filtersToApiQuery(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.sort === "date") p.set("sort", "publication_date:desc");
  if (f.sort === "citations") p.set("sort", "cited_by_count:desc");
  const filterParts: string[] = [];
  if (f.from || f.to) {
    const from = f.from ?? "1900";
    const to = f.to ?? String(new Date().getFullYear());
    filterParts.push(`publication_year:${from}-${to}`);
  }
  if (f.oa) filterParts.push("open_access.is_oa:true");
  if (filterParts.length > 0) p.set("filter", filterParts.join(","));
  return p;
}

export function isDefaultFilters(f: Filters): boolean {
  return (
    f.sort === DEFAULT_FILTERS.sort &&
    f.from === null &&
    f.to === null &&
    !f.oa &&
    f.cites === null &&
    f.src === null &&
    f.venue === null
  );
}
