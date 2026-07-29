export type SalaryPeriod = "hour" | "month" | "year";

export type NormalizedSalary = {
  min: number;
  max: number;
  currency: string;
  period: SalaryPeriod;
};

export type StructuredSalaryInput = {
  min?: number | null;
  max?: number | null;
  currency?: string | null;
  period?: string | null;
};

export const SALARY_NOT_DISCLOSED = "Salary not disclosed";

const PERIODS: Record<string, SalaryPeriod> = {
  hr: "hour",
  hour: "hour",
  hourly: "hour",
  mo: "month",
  month: "month",
  monthly: "month",
  yr: "year",
  year: "year",
  annual: "year",
  annually: "year",
};

const CURRENCIES: Record<string, string> = {
  $: "USD",
  "€": "EUR",
  "£": "GBP",
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
};

const SALARY_TEXT_RE =
  /^(?:OTE\s+)?(?<currency>\$|€|£|[A-Z]{3})\s*(?<min>\d[\d,.]*\s*[kK]?)(?:\s*[-–—]\s*(?<rangeCurrency>\$|€|£|[A-Z]{3})?\s*(?<max>\d[\d,.]*\s*[kK]?))?\s*(?:\/|\bper\s+)?\s*(?<period>hr|hour|hourly|mo|month|monthly|yr|year|annual|annually)?$/i;

// Annualized bounds a displayed salary must fall inside. A number outside them
// is far more likely to be malformed source data than a real offer, and showing
// it as fact is worse than showing nothing.
const MIN_ANNUALIZED = 5_000;
const MAX_ANNUALIZED = 2_000_000;

const ANNUALIZATION: Record<SalaryPeriod, number> = {
  hour: 2_080,
  month: 12,
  year: 1,
};

/**
 * The single sanity gate for every salary we display, whichever path produced
 * it. Both `parseSalaryText` and `normalizeSalary` must run through this —
 * a free-text "$3k - $10k" is exactly as implausible as the structured
 * equivalent, and Remotive really does return that string.
 */
function isPlausible(min: number, max: number, period: SalaryPeriod): boolean {
  const factor = ANNUALIZATION[period];
  return min * factor >= MIN_ANNUALIZED && max * factor <= MAX_ANNUALIZED;
}

function parseAmount(input: string): number | null {
  const compact = input.replace(/\s+/g, "");
  const hasThousandsSuffix = /k$/i.test(compact);
  let numeric = compact.replace(/k$/i, "");

  // European decimal comma, but only before a `k` suffix and only with one or
  // two decimal places — "$31,2k" is 31 200 and "$31,25k" is 31 250, while
  // "$1,000k" is a thousands separator and must not be re-read as a decimal.
  if (hasThousandsSuffix && /^\d+,\d{1,2}$/.test(numeric)) {
    numeric = numeric.replace(",", ".");
  } else {
    numeric = numeric.replace(/,/g, "");
  }

  const amount = Number(numeric) * (hasThousandsSuffix ? 1_000 : 1);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function currencyCode(value: string): string {
  return CURRENCIES[value] ?? value.toUpperCase();
}

function normalizePeriod(value: string): SalaryPeriod | null {
  const key = value.trim().toLowerCase().replace(/^per[\s_-]*/, "");
  return PERIODS[key] ?? null;
}

export function parseSalaryText(input: string | null | undefined): NormalizedSalary | null {
  const text = input?.trim();
  if (!text) return null;

  const match = SALARY_TEXT_RE.exec(text);
  if (!match?.groups) return null;

  const min = parseAmount(match.groups.min);
  const max = match.groups.max ? parseAmount(match.groups.max) : min;
  if (min === null || max === null || max < min) return null;

  const firstCurrency = currencyCode(match.groups.currency);
  const secondCurrency = match.groups.rangeCurrency
    ? currencyCode(match.groups.rangeCurrency)
    : firstCurrency;
  if (firstCurrency !== secondCurrency) return null;

  const explicitPeriod = match.groups.period?.toLowerCase();
  const period = explicitPeriod ? PERIODS[explicitPeriod] : inferPeriod(Math.min(min, max));
  if (!period) return null;

  return isPlausible(min, max, period)
    ? { min, max, currency: firstCurrency, period }
    : null;
}

/**
 * Period for a value carrying no `/hr`-style marker. Only the unambiguous ends
 * of the scale get a guess: above 1 000 is an annual figure, and a real hourly
 * rate is small. Between those lies a band where "$500" could plausibly be a
 * daily rate, a stipend, or a typo — guessing there produces confident
 * nonsense like "$500 / hr", so we decline instead.
 */
function inferPeriod(value: number): SalaryPeriod | null {
  if (value > 1_000) return "year";
  if (value <= 300) return "hour";
  return null;
}

export function normalizeSalary(input: StructuredSalaryInput): NormalizedSalary | null {
  const providedMin = input.min;
  const providedMax = input.max;
  if (providedMin == null && providedMax == null) return null;

  const min = providedMin ?? providedMax;
  const max = providedMax ?? providedMin;
  const currency = input.currency?.trim();
  const period = input.period ? normalizePeriod(input.period) : null;

  if (
    min == null ||
    max == null ||
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    min <= 0 ||
    max < min ||
    !currency ||
    !period
  ) {
    return null;
  }

  if (!isPlausible(min, max, period)) return null;

  return {
    min,
    max,
    currency: currencyCode(currency),
    period,
  };
}

function compactAmount(value: number): string {
  const decimal = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
  if (value < 1_000) return decimal.format(value);
  // Past a million, "1,500k" reads as a mistake — step up a unit.
  if (value >= 1_000_000) return `${decimal.format(value / 1_000_000)}M`;
  return `${decimal.format(value / 1_000)}k`;
}

export function formatSalary(salary: NormalizedSalary): string {
  const symbol = CURRENCY_SYMBOLS[salary.currency.toUpperCase()];
  const prefix = symbol ?? `${salary.currency.toUpperCase()} `;
  const range =
    salary.min === salary.max
      ? compactAmount(salary.min)
      : `${compactAmount(salary.min)}–${compactAmount(salary.max)}`;
  const period = salary.period === "hour" ? "hr" : salary.period === "month" ? "mo" : "yr";

  return `${prefix}${range} / ${period}`;
}
