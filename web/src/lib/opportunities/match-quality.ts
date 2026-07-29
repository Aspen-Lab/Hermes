import { formatMatchPct } from "@/lib/format";

export type MatchQuality = {
  pct: number;
  band: "strong" | "relevant" | "marginal";
  label: string;
};

export function matchQuality(score: number | null | undefined): MatchQuality | null {
  if (score == null || !Number.isFinite(score)) return null;

  const pct = formatMatchPct(score);
  if (pct === null) return null;

  if (score >= 0.9) return { pct, band: "strong", label: "Strong match" };
  if (score >= 0.7) return { pct, band: "relevant", label: "Relevant" };
  return { pct, band: "marginal", label: "Marginal" };
}
