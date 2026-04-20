const MS_PER_DAY = 24 * 60 * 60 * 1000;
const HALF_LIFE_DAYS = 14;

export function scoreRecency(publishedAt: string, now = Date.now()): number {
  if (!publishedAt) return 0.5;
  const t = Date.parse(publishedAt);
  if (!Number.isFinite(t)) return 0.5;
  const ageDays = Math.max(0, (now - t) / MS_PER_DAY);
  return Math.exp(-ageDays / HALF_LIFE_DAYS);
}
