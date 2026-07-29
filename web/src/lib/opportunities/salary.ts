export type SalaryPeriod = "hour" | "month" | "year";

export type NormalizedSalary = {
  min: number;
  max: number;
  currency: string;
  period: SalaryPeriod;
};

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
