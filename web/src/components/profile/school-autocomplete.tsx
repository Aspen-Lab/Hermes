"use client";

// Text input + dropdown for picking a research affiliation. Free-text is
// allowed (you can type anything), but as the user types, suggestions from
// COMMON_AFFILIATIONS surface in a dropdown for quick selection.
//
// Behaviour:
//   - Focus opens the dropdown (showing top suggestions).
//   - Typing filters by case-insensitive substring.
//   - ↑ / ↓ moves the highlighted suggestion.
//   - Enter / Tab / click commits the highlighted suggestion.
//   - Escape closes the dropdown without committing.
//   - Blur outside the component closes the dropdown after a brief delay
//     so a click on a suggestion still registers.
//
// State is kept in sync: typing always updates `value` via onChange, so
// any draft becomes the persisted value if the user just leaves it as-is.

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { matchAffiliations } from "@/lib/profile/affiliations";

interface SchoolAutocompleteProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  /** Max items shown in the dropdown. */
  limit?: number;
}

export function SchoolAutocomplete({
  value,
  onChange,
  placeholder = "Type to search universities, labs…",
  limit = 8,
}: SchoolAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(
    () => matchAffiliations(value, limit),
    [value, limit],
  );

  // Click outside closes the dropdown.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const commit = (pick: string) => {
    onChange(pick);
    setOpen(false);
    inputRef.current?.blur();
  };

  const activeIndex =
    matches.length > 0 ? Math.min(highlighted, matches.length - 1) : 0;

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if ((e.key === "Enter" || e.key === "Tab") && matches.length > 0) {
      // Only commit a suggestion if user has interacted (highlighted > 0)
      // OR the typed value exactly matches the top match. Otherwise let
      // the user type freely without auto-replacing.
      const exact = matches[0]?.toLowerCase() === value.trim().toLowerCase();
      if (exact || highlighted > 0) {
        e.preventDefault();
        commit(matches[activeIndex]);
      } else {
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setHighlighted(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="w-full bg-bg-secondary/40 rounded-lg px-3 py-2 text-[14px] text-text placeholder-text-faint/60 outline-none focus:bg-bg-secondary/60 focus:ring-2 focus:ring-accent/20 transition-all"
        autoComplete="off"
        spellCheck={false}
      />

      {open && matches.length > 0 && (
        <ul
          role="listbox"
          className="absolute z-20 mt-1 left-0 right-0 max-h-60 overflow-y-auto rounded-lg bg-surface shadow-card-hover border border-border/60 py-1"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          {matches.map((m, i) => {
            const active = i === activeIndex;
            const lower = value.trim().toLowerCase();
            const idx = lower ? m.toLowerCase().indexOf(lower) : -1;
            return (
              <li
                key={m}
                role="option"
                aria-selected={active}
                onMouseDown={(e) => {
                  // mousedown so it fires before input blur
                  e.preventDefault();
                  commit(m);
                }}
                onMouseEnter={() => setHighlighted(i)}
                className={[
                  "px-3 py-1.5 text-[13.5px] cursor-pointer transition-colors",
                  active
                    ? "bg-accent-dim/70 text-heading"
                    : "text-text hover:bg-bg-secondary/60",
                ].join(" ")}
              >
                {idx === -1 ? (
                  m
                ) : (
                  <>
                    {m.slice(0, idx)}
                    <span className="font-semibold text-accent">
                      {m.slice(idx, idx + lower.length)}
                    </span>
                    {m.slice(idx + lower.length)}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
