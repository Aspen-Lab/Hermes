import type { SourceId } from "@/lib/sources/types";
import { DEFAULT_SOURCE_WEIGHTS } from "./types";

export function scoreSource(
  source: SourceId,
  overrides?: Partial<Record<SourceId, number>>,
): number {
  const w = overrides?.[source] ?? DEFAULT_SOURCE_WEIGHTS[source] ?? 0.5;
  return Math.max(0, Math.min(1, w));
}
