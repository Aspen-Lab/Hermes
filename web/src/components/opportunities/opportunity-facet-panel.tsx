"use client";

import { useState } from "react";
import type {
  OpportunityFacetCounts,
  OpportunityFacetSelection,
  OpportunityFormat,
} from "@/types";
import { FilterChip } from "@/components/search/filter-chip";

type FacetGroup = keyof OpportunityFacetSelection;

interface OpportunityFacetPanelProps {
  counts: OpportunityFacetCounts;
  selection: OpportunityFacetSelection;
  onChange: (selection: OpportunityFacetSelection) => void;
  scopeLabel: string;
}

interface FacetOption {
  value: string;
  label: string;
  count: number;
}

const VISIBLE_OPTIONS = 6;
const FORMAT_LABELS: Record<OpportunityFormat, string> = {
  "in-person": "线下",
  online: "线上",
  hybrid: "混合",
};

const GROUP_LABELS: Record<FacetGroup, string> = {
  location: "地点",
  month: "时间",
  format: "形式",
};

function normalized(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function selectionValues(
  selection: OpportunityFacetSelection,
  group: FacetGroup,
): string[] {
  return (selection[group] ?? []) as string[];
}

export function toggleOpportunityFacet(
  selection: OpportunityFacetSelection,
  group: FacetGroup,
  value: string,
): OpportunityFacetSelection {
  const current = selectionValues(selection, group);
  const key = normalized(value);
  const active = current.some((candidate) => normalized(candidate) === key);
  const next = active
    ? current.filter((candidate) => normalized(candidate) !== key)
    : [...current, value];
  return {
    ...selection,
    [group]: next.length > 0 ? next : undefined,
  };
}

function formatMonth(value: string): string {
  const match = value.match(/^(\d{4})-(\d{2})$/);
  if (!match) return value;
  return `${match[1]}年${Number(match[2])}月`;
}

function optionsFor(
  group: FacetGroup,
  counts: OpportunityFacetCounts,
): FacetOption[] {
  if (group === "format") {
    return (Object.keys(FORMAT_LABELS) as OpportunityFormat[])
      .map((value) => ({
        value,
        label: FORMAT_LABELS[value],
        count: counts.format[value],
      }))
      .filter((option) => option.count > 0);
  }

  const options = Object.entries(counts[group])
    .filter(([, count]) => count > 0)
    .map(([value, count]) => ({
      value,
      label: group === "month" ? formatMonth(value) : value,
      count,
    }));
  return options.sort((left, right) =>
    group === "month"
      ? left.value.localeCompare(right.value)
      : right.count - left.count || left.label.localeCompare(right.label),
  );
}

function isSelected(
  selection: OpportunityFacetSelection,
  group: FacetGroup,
  value: string,
): boolean {
  const key = normalized(value);
  return selectionValues(selection, group).some(
    (candidate) => normalized(candidate) === key,
  );
}

export function OpportunityFacetPanel({
  counts,
  selection,
  onChange,
  scopeLabel,
}: OpportunityFacetPanelProps) {
  const [expanded, setExpanded] = useState<
    Partial<Record<FacetGroup, boolean>>
  >({});
  const total = Object.values(counts.format).reduce(
    (sum, count) => sum + count,
    0,
  );
  const activeCount =
    (selection.location?.length ?? 0) +
    (selection.month?.length ?? 0) +
    (selection.format?.length ?? 0);

  return (
    <section
      aria-label="机会筛选"
      className="mt-4 rounded-3xl glass shadow-card px-4 py-4 sm:px-5"
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-body-sm font-semibold tracking-[-0.01em] text-heading">
            今日机会池
          </p>
          <p className="mt-0.5 text-caption text-text-muted">
            {scopeLabel}共 {total} 条 · 今天刷新仍是同一批结果
          </p>
        </div>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onChange({})}
            className="shrink-0 rounded-full px-3 py-1.5 text-caption font-medium text-accent transition-colors hover:bg-accent/10"
          >
            清除筛选
          </button>
        )}
      </div>

      <div className="space-y-3.5">
        {(["location", "month", "format"] as FacetGroup[]).map((group) => {
          const options = optionsFor(group, counts);
          const showAll = expanded[group] || options.length <= VISIBLE_OPTIONS;
          const visible = showAll
            ? options
            : options.slice(0, VISIBLE_OPTIONS);
          const hiddenCount = options.length - visible.length;

          return (
            <div
              key={group}
              role="group"
              aria-label={GROUP_LABELS[group]}
              className="grid min-w-0 gap-2 sm:grid-cols-[52px_minmax(0,1fr)] sm:items-start"
            >
              <span className="text-caption font-medium text-text-muted sm:pt-2.5">
                {GROUP_LABELS[group]}
              </span>
              <div className="flex min-w-0 flex-wrap gap-2">
                {visible.length === 0 ? (
                  <span className="py-2 text-caption text-text-faint">
                    暂无可用项
                  </span>
                ) : (
                  visible.map((option) => {
                    const active = isSelected(
                      selection,
                      group,
                      option.value,
                    );
                    return (
                      <FilterChip
                        key={option.value}
                        label={option.label}
                        displayValue={`${option.label} ${option.count}`}
                        active={active}
                        onClick={() =>
                          onChange(
                            toggleOpportunityFacet(
                              selection,
                              group,
                              option.value,
                            ),
                          )
                        }
                        onClear={
                          active
                            ? () =>
                                onChange(
                                  toggleOpportunityFacet(
                                    selection,
                                    group,
                                    option.value,
                                  ),
                                )
                            : undefined
                        }
                        ariaLabel={`${active ? "取消" : "按"}${GROUP_LABELS[group]}${option.label}筛选，${option.count} 条`}
                      />
                    );
                  })
                )}
                {options.length > VISIBLE_OPTIONS && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((current) => ({
                        ...current,
                        [group]: !current[group],
                      }))
                    }
                    aria-expanded={Boolean(expanded[group])}
                    className="h-10 rounded-full px-3 text-caption font-medium text-text-muted transition-colors hover:bg-bg-secondary hover:text-heading"
                  >
                    {expanded[group] ? "收起" : `更多 +${hiddenCount}`}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
