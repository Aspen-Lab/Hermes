"use client";

import { DEFAULT_FILTERS, isDefaultFilters, type Filters } from "@/lib/search/filters";

interface FilterBarProps {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

const SORT_OPTIONS: { value: Filters["sort"]; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "date", label: "Newest" },
  { value: "citations", label: "Most cited" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 15 }, (_, i) => CURRENT_YEAR - i);

export function FilterBar({ filters, onChange, onReset }: FilterBarProps) {
  const dirty = !isDefaultFilters(filters);

  return (
    <div
      className="mt-4 flex items-center flex-wrap gap-2"
      style={{ fontFamily: "var(--font-sans)" }}
    >
      {/* Sort */}
      <div className="flex items-center gap-1 rounded-lg bg-surface shadow-card p-1">
        {SORT_OPTIONS.map((opt) => {
          const active = filters.sort === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange({ sort: opt.value })}
              className={[
                "px-3 py-1 rounded-md text-[12.5px] font-medium transition-all duration-150",
                active
                  ? "bg-heading text-bg"
                  : "text-text-muted hover:text-heading",
              ].join(" ")}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Year from */}
      <select
        value={filters.from ?? ""}
        onChange={(e) => onChange({ from: e.target.value || null })}
        className="h-8 rounded-lg bg-surface shadow-card px-2 text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-accent/20"
      >
        <option value="">From year</option>
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>

      {/* Year to */}
      <select
        value={filters.to ?? ""}
        onChange={(e) => onChange({ to: e.target.value || null })}
        className="h-8 rounded-lg bg-surface shadow-card px-2 text-[12.5px] text-text focus:outline-none focus:ring-2 focus:ring-accent/20"
      >
        <option value="">To year</option>
        {YEAR_OPTIONS.map((y) => (
          <option key={y} value={String(y)}>{y}</option>
        ))}
      </select>

      {/* Open access toggle */}
      <button
        onClick={() => onChange({ oa: !filters.oa })}
        className={[
          "h-8 px-3 rounded-lg text-[12.5px] font-medium shadow-card transition-all duration-150",
          filters.oa
            ? "bg-tag text-bg"
            : "bg-surface text-text-muted hover:text-heading",
        ].join(" ")}
      >
        Open access
      </button>

      {/* Reset */}
      {dirty && (
        <button
          onClick={onReset}
          className="h-8 px-3 rounded-lg text-[12.5px] text-text-faint hover:text-accent transition-colors duration-150"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
