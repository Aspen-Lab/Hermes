"use client";

import { useMemo, useState } from "react";
import { COUNTRY_NAMES } from "@/lib/opportunities/structured-extract";

export function CountryMultiSelect({
  values,
  onChange,
  idPrefix = "authorised-country",
}: {
  values: string[];
  onChange: (countries: string[]) => void;
  idPrefix?: string;
}) {
  const [query, setQuery] = useState("");
  const selectedKeys = useMemo(
    () =>
      new Set(
        values.map((country) => country.trim().toLocaleLowerCase()),
      ),
    [values],
  );
  const suggestions = useMemo(() => {
    const key = query.trim().toLocaleLowerCase();
    if (!key) return [];
    return COUNTRY_NAMES.filter(
      (country) =>
        !selectedKeys.has(country.toLocaleLowerCase()) &&
        country.toLocaleLowerCase().includes(key),
    ).slice(0, 8);
  }, [query, selectedKeys]);

  const addCountry = (country: string) => {
    if (selectedKeys.has(country.toLocaleLowerCase())) return;
    onChange([...values, country]);
    setQuery("");
  };
  const optionsId = `${idPrefix}-options`;

  return (
    <div>
      {values.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {values.map((country) => (
            <button
              key={country}
              type="button"
              onClick={() =>
                onChange(
                  values.filter(
                    (candidate) =>
                      candidate.toLocaleLowerCase() !==
                      country.toLocaleLowerCase(),
                  ),
                )
              }
              className="rounded-full bg-bg-secondary/70 px-2.5 py-1 text-meta text-text-muted transition-colors hover:bg-accent-dim hover:text-accent"
              aria-label={`Remove ${country}`}
            >
              {country} ×
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <label htmlFor={idPrefix} className="sr-only">
          Add a country
        </label>
        <input
          id={idPrefix}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && suggestions[0]) {
              event.preventDefault();
              addCountry(suggestions[0]);
            }
          }}
          placeholder="Search countries"
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={Boolean(query.trim())}
          aria-controls={optionsId}
          className="w-full rounded-lg bg-bg-secondary/40 px-3 py-2 text-body text-text outline-none transition-all placeholder:text-text-faint/60 focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20"
        />
        {query.trim() && (
          <div
            id={optionsId}
            role="listbox"
            aria-label="Country options"
            className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-card-hover"
          >
            {suggestions.length > 0 ? (
              suggestions.map((country) => (
                <button
                  key={country}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => addCountry(country)}
                  className="block w-full rounded-lg px-3 py-2 text-left text-body-sm text-text transition-colors hover:bg-bg-secondary"
                >
                  {country}
                </button>
              ))
            ) : (
              <p className="px-3 py-2 text-caption text-text-faint">
                Choose a country from the list.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
