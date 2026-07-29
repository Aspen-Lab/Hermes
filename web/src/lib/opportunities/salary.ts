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

function parseAmount(input: string): number | null {
  const compact = input.replace(/\s+/g, "");
  const hasThousandsSuffix = /k$/i.test(compact);
  let numeric = compact.replace(/k$/i, "");

  if (hasThousandsSuffix && /^\d+,\d$/.test(numeric)) {
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
  const period = explicitPeriod
    ? PERIODS[explicitPeriod]
    : Math.min(min, max) > 1_000
      ? "year"
      : "hour";

  return { min, max, currency: firstCurrency, period };
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

  const annualizationFactor = period === "hour" ? 2_080 : period === "month" ? 12 : 1;
  const annualizedFloor = min * annualizationFactor;
  const annualizedCeiling = max * annualizationFactor;
  if (annualizedFloor < 5_000 || annualizedCeiling > 2_000_000) return null;

  return {
    min,
    max,
    currency: currencyCode(currency),
    period,
  };
}

function compactAmount(value: number): string {
  if (value < 1_000) return new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(value);

  const thousands = value / 1_000;
  return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 }).format(thousands)}k`;
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
