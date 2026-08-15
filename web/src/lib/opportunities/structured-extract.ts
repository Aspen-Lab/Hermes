import { canonicalize } from "@/lib/scoring/term-expand";
import type { OpportunityPlace } from "@/types";
import { cleanJobSubtitlePart } from "./job-cleanup";
import { normalizeSalary, type NormalizedSalary } from "./salary";

export type ExtractedPlace = OpportunityPlace;

export interface JsonLdOpportunity {
  kind: "event" | "job";
  name?: string;
  startDate?: string;
  endDate?: string;
  /** schema.org JobPosting.datePosted — a job's equivalent of a start date. */
  datePosted?: string;
  /** schema.org JobPosting.validThrough — the application deadline. */
  validThrough?: string;
  place?: ExtractedPlace;
  eventAttendanceMode?: string;
  /**
   * B4-11. schema.org JobPosting.baseSalary, run through the same
   * plausibility gate (`normalizeSalary`) every other salary source already
   * uses — a malformed or out-of-range figure is dropped here, the same as
   * Adzuna's or USAJobs's own structured salary fields, never shown as fact.
   */
  salary?: NormalizedSalary;
  /**
   * B4-11. schema.org JobPosting.employmentType — a raw slug, lower-cased to
   * match the convention every existing source already emits (Adzuna's
   * `contract_time` is "full_time"), so the report's existing `humanize()`
   * renders it the same way regardless of which source found it.
   */
  employmentType?: string;
  /** Provenance retained only for selected-posting ownership checks. */
  url?: string;
  description?: string;
  /** Selected JobPosting-only employer provenance; never read unscoped. */
  hiringOrganization?: string;
}

export interface OpenGraphTags {
  title?: string;
  description?: string;
  siteName?: string;
}

export interface MetaOpportunityDetails {
  start?: string;
  end?: string;
  city?: string;
  region?: string;
  isOnline: boolean;
}

export interface OpportunityPageDetails {
  /** A name asserted by a matching schema.org Event record, never page chrome. */
  typedOpportunityName?: string;
  /** Description from exactly one typed Event record. */
  typedOpportunityDescription?: string;
  /** Low-authority page metadata; callers must apply their normal title guard. */
  openGraphTitle?: string;
  openGraphDescription?: string;
  startDate?: string;
  endDate?: string;
  /** When the posting went up. Jobs carry this instead of a start date. */
  datePosted?: string;
  place?: ExtractedPlace;
  isOnline: boolean;
}

type JsonRecord = Record<string, unknown>;

const MONTHS: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const MONTH_PATTERN =
  "January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec";

const DATE_RANGE_PATTERN = new RegExp(
  `\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:\\s*[-–—]\\s*(?:(${MONTH_PATTERN})\\s+)?(\\d{1,2}))?,?\\s+(\\d{4})\\b`,
  "i",
);

const CONFERENCE_CITY_LINES = `
Abidjan
Abu Dhabi
Abuja
Accra
Aachen
Adelaide
Addis Ababa
Ahmedabad
Albany
Albuquerque
Alexandria
Algiers
Alicante
Amsterdam
Anaheim
Anchorage
Ankara
Ann Arbor
Antalya
Antananarivo
Antwerp
Arlington
Asuncion
Athens
Atlanta
Auckland
Austin
Aarhus
Bali
Baltimore
Bangalore
Bandung
Banff
Bangkok
Barcelona
Basel
Baton Rouge
Beijing
Beirut
Belfast
Belgrade
Belo Horizonte
Bengaluru
Bergen
Berkeley
Berlin
Bern
Bethesda
Bilbao
Birmingham
Bishkek
Bogota
Bogotá
Bologna
Bonn
Bordeaux
Boston
Boulder
Bratislava
Brasilia
Bridgetown
Brighton
Brisbane
Bristol
Brno
Brussels
Bucharest
Budapest
Buenos Aires
Buffalo
Busan
Cairns
Cali
Calgary
Cambridge
Campinas
Canberra
Cancun
Cape Town
Cardiff
Cartagena
Casablanca
Cebu
Chandigarh
Changsha
Chapel Hill
Charleston
Charlotte
Chattanooga
Chengdu
Chennai
Chiang Mai
Chicago
Chongqing
Christchurch
Cincinnati
Cleveland
Cluj Napoca
Coimbra
Cologne
Colombo
College Park
College Station
Colorado Springs
Columbus
Copenhagen
Cordoba
Cork
Coventry
Cusco
Da Nang
Dakar
Dallas
Dalian
Dar es Salaam
Darwin
Daejeon
Delft
Delhi
Denver
Des Moines
Detroit
Dhaka
Doha
Dresden
Dubai
Dublin
Durban
Durham
Dusseldorf
Edinburgh
Edmonton
Eindhoven
Espoo
Faro
Florence
Florianopolis
Fort Lauderdale
Frankfurt
Fukuoka
Gainesville
Galway
Gdansk
Geneva
Genoa
Geelong
Ghent
Glasgow
Goa
Gold Coast
Gothenburg
Granada
Grenoble
Guadalajara
Guangzhou
Guatemala City
Guayaquil
Gurugram
Gwangju
Haifa
Halifax
Hamburg
Hamilton
Hangzhou
Hanoi
Hanover
Harare
Harbin
Hartford
Hefei
Heidelberg
Helsinki
Heraklion
Hiroshima
Ho Chi Minh City
Hobart
Hong Kong
Honolulu
Houston
Hyderabad
Indianapolis
Incheon
Innsbruck
Iowa City
Islamabad
Istanbul
Ithaca
Izmir
Jacksonville
Jaipur
Jakarta
Jeddah
Jeju
Jersey City
Jerusalem
Johannesburg
Johor Bahru
Kaohsiung
Karachi
Karlsruhe
Kansas City
Kaunas
Kathmandu
Khartoum
Kigali
Kingston
Kitchener
Kobe
Kochi
Kolkata
Krakow
Kuala Lumpur
Kampala
Kunming
Kuwait City
Kyiv
Kyoto
La Paz
Lagos
Lahore
Lausanne
Leeds
Leipzig
Leuven
Lexington
Liege
Lille
Lima
Lincoln
Linz
Lisbon
Liverpool
Ljubljana
Lodz
London
Long Beach
Los Angeles
Louisville
Lucerne
Lugano
Lund
Lusaka
Luxembourg
Lviv
Lyon
Macau
Madison
Madrid
Maastricht
Malaga
Malmo
Manama
Manchester
Manila
Managua
Maputo
Marrakech
Marseille
Medellin
Melbourne
Memphis
Mendoza
Merida
Mexico City
Miami
Milan
Milwaukee
Minneapolis
Mombasa
Monaco
Monterrey
Montevideo
Montpellier
Montreal
Montréal
Montreal
Moscow
Mumbai
Munich
Muscat
Nagoya
Nairobi
Nanjing
Nantes
Naples
Nashville
Nassau
New Delhi
New Haven
New Orleans
New York
Newark
Newcastle
Nicosia
Ningbo
Noida
Norfolk
Nottingham
Nuremberg
Oakland
Odense
Oklahoma City
Omaha
Orlando
Osaka
Oslo
Ottawa
Oxford
Padua
Palo Alto
Panama City
Paris
Pasadena
Penang
Perth
Philadelphia
Phoenix
Phuket
Pisa
Pittsburgh
Port Louis
Port of Spain
Portland
Porto
Porto Alegre
Potsdam
Poznan
Prague
Pretoria
Princeton
Providence
Puebla
Pune
Putrajaya
Quebec City
Queenstown
Quezon City
Queretaro
Quito
Rabat
Raleigh
Recife
Regina
Reykjavik
Rennes
Richmond
Riga
Rio de Janeiro
Riyadh
Rochester
Rockville
Rome
Rosario
Rotterdam
Sacramento
Salvador
Salzburg
Salt Lake City
San Antonio
San Diego
San Francisco
San Jose
San Juan
San Salvador
Santa Barbara
Santa Clara
Santiago
Santiago de Compostela
Santo Domingo
Sao Paulo
São Paulo
Sapporo
Sarajevo
Saskatoon
Savannah
Seattle
Sendai
Seoul
Seville
Shanghai
Sheffield
Shenzhen
Singapore
Skopje
Sofia
Southampton
St Louis
St Petersburg
Stavanger
Stellenbosch
Stockholm
Strasbourg
Stuttgart
Surabaya
Suwon
Suzhou
Sydney
Syracuse
Taichung
Taipei
Tallinn
Tallahassee
Tampa
Tampere
Tartu
Tbilisi
Tegucigalpa
Tehran
Tel Aviv
Tempe
The Hague
Thessaloniki
Tianjin
Tirana
Tokyo
Toronto
Toulouse
Trondheim
Trieste
Tucson
Tulsa
Tunis
Turin
Turku
Uppsala
Utrecht
Valencia
Valletta
Valparaiso
Vancouver
Venice
Victoria
Vienna
Vilnius
Virginia Beach
Warsaw
Washington
Waterloo
Wellington
Whistler
Wichita
Windhoek
Winnipeg
Wollongong
Worcester
Wroclaw
Wuhan
Xi'an
Xiamen
Yogyakarta
Yokohama
Zagreb
Zaragoza
Zurich
Zürich
`.trim();

/**
 * Broad but bounded fallback vocabulary. Detail-page body matching is used
 * only after JSON-LD and Open Graph both fail, so this list favors established
 * conference hubs while the higher-confidence signals remain authoritative.
 */
export const CONFERENCE_CITIES = Array.from(
  new Set(
    CONFERENCE_CITY_LINES.split(/\r?\n/)
      .map((city) => city.trim())
      .filter(Boolean),
  ),
);

export const US_STATE_CODES = [
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
  "DC",
] as const;

const COUNTRY_NAME_LINES = `
Afghanistan
Albania
Algeria
Andorra
Angola
Antigua and Barbuda
Argentina
Armenia
Australia
Austria
Azerbaijan
Bahamas
Bahrain
Bangladesh
Barbados
Belarus
Belgium
Belize
Benin
Bhutan
Bolivia
Bosnia and Herzegovina
Botswana
Brazil
Brunei
Bulgaria
Burkina Faso
Burundi
Cabo Verde
Cambodia
Cameroon
Canada
Central African Republic
Chad
Chile
China
Colombia
Comoros
Costa Rica
Croatia
Cuba
Cyprus
Czech Republic
Czechia
Democratic Republic of the Congo
Denmark
Djibouti
Dominica
Dominican Republic
Ecuador
Egypt
El Salvador
Equatorial Guinea
Eritrea
Estonia
Eswatini
Ethiopia
Fiji
Finland
France
Gabon
Gambia
Georgia
Germany
Ghana
Greece
Grenada
Guatemala
Guinea
Guinea-Bissau
Guyana
Haiti
Honduras
Hungary
Iceland
India
Indonesia
Iran
Iraq
Ireland
Israel
Italy
Ivory Coast
Jamaica
Japan
Jordan
Kazakhstan
Kenya
Kiribati
Kuwait
Kyrgyzstan
Laos
Latvia
Lebanon
Lesotho
Liberia
Libya
Liechtenstein
Lithuania
Luxembourg
Madagascar
Malawi
Malaysia
Maldives
Mali
Malta
Marshall Islands
Mauritania
Mauritius
Mexico
Micronesia
Moldova
Monaco
Mongolia
Montenegro
Morocco
Mozambique
Myanmar
Namibia
Nauru
Nepal
Netherlands
New Zealand
Nicaragua
Niger
Nigeria
North Korea
North Macedonia
Norway
Oman
Pakistan
Palau
Palestine
Panama
Papua New Guinea
Paraguay
Peru
Philippines
Poland
Portugal
Qatar
Republic of the Congo
Romania
Russia
Rwanda
Saint Kitts and Nevis
Saint Lucia
Saint Vincent and the Grenadines
Samoa
San Marino
Sao Tome and Principe
Saudi Arabia
Senegal
Serbia
Seychelles
Sierra Leone
Singapore
Slovakia
Slovenia
Solomon Islands
Somalia
South Africa
South Korea
South Sudan
Spain
Sri Lanka
Sudan
Suriname
Sweden
Switzerland
Syria
Taiwan
Tajikistan
Tanzania
Thailand
Timor-Leste
Togo
Tonga
Trinidad and Tobago
Tunisia
Turkey
Turkmenistan
Tuvalu
Uganda
Ukraine
United Arab Emirates
United Kingdom
United States
United States of America
Uruguay
Uzbekistan
Vanuatu
Vatican City
Venezuela
Vietnam
Yemen
Zambia
Zimbabwe
`.trim();

export const COUNTRY_NAMES = COUNTRY_NAME_LINES.split(/\r?\n/)
  .map((country) => country.trim())
  .filter(Boolean);

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function schemaTypeName(value: string): string {
  const withoutTrailingSlash = value.trim().replace(/\/+$/, "");
  const separator = Math.max(
    withoutTrailingSlash.lastIndexOf("/"),
    withoutTrailingSlash.lastIndexOf("#"),
  );
  return withoutTrailingSlash.slice(separator + 1).toLowerCase();
}

function opportunityKind(value: unknown): JsonLdOpportunity["kind"] | null {
  const rawTypes = Array.isArray(value) ? value : [value];
  const types = rawTypes
    .filter((type): type is string => typeof type === "string")
    .map(schemaTypeName);

  if (types.includes("jobposting")) return "job";
  if (types.some((type) => type === "event" || type.endsWith("event"))) {
    return "event";
  }
  return null;
}

function firstRecord(value: unknown): JsonRecord | undefined {
  if (isRecord(value)) return value;
  if (!Array.isArray(value)) return undefined;
  return value.find(isRecord);
}

function countryName(value: unknown): string | undefined {
  const direct = nonEmptyString(value);
  if (direct) return direct;
  if (!isRecord(value)) return undefined;
  return nonEmptyString(value.name);
}

/**
 * Real place names are short. Pages routinely put a tagline or a whole
 * sentence where a locality belongs, and one live pool ended up with a facet
 * reading "Quintus Technologies / The Global Leader in isostatic pressing
 * technologies is your partner of choice." Because these values become
 * user-facing filter buttons, an implausible one is worse than none.
 */
const MAX_PLACE_WORDS = 4;
const MAX_PLACE_CHARS = 40;
const SENTENCE_PUNCTUATION_RE = /[.!?;:|]|\s-\s/;

export function plausiblePlaceName(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed || trimmed.length > MAX_PLACE_CHARS) return undefined;
  if (trimmed.split(" ").length > MAX_PLACE_WORDS) return undefined;
  if (SENTENCE_PUNCTUATION_RE.test(trimmed)) return undefined;
  // Needs at least one letter; "2026" or "—" is not a place.
  if (!/\p{L}/u.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Drop implausible components so a bad value never reaches a facet button, and
 * make equivalent places produce identical labels.
 *
 * Two normalizations matter for faceting specifically. A `city` that still
 * carries a comma is a whole address, not a locality — some feeds put
 * "Columbia, SC, United States" in `addressLocality`, which produced a facet
 * button of that exact string sitting beside a plain "Aiken". And country
 * spellings vary by source ("US", "USA", "United States of America"), which
 * would otherwise split one country across several buttons.
 */
export function sanitizePlace(
  place: ExtractedPlace | undefined,
): ExtractedPlace | undefined {
  if (!place) return undefined;

  let city = place.city?.trim();
  let region = place.region;
  let country = place.country;

  if (city?.includes(",")) {
    const segments = city.split(",").map((s) => s.trim()).filter(Boolean);
    city = segments[0];
    for (const segment of segments.slice(1)) {
      const asCountry = matchCountryToken(segment);
      if (asCountry) {
        country ??= asCountry;
        continue;
      }
      if ((US_STATE_CODES as readonly string[]).includes(segment.toUpperCase())) {
        region ??= segment.toUpperCase();
      }
    }
  }

  const cleaned: ExtractedPlace = {
    city: plausiblePlaceName(city),
    region: plausiblePlaceName(region),
    // Canonical spelling so "US"/"USA"/"United States of America" collapse.
    country:
      (country ? matchCountryToken(country) : undefined) ??
      plausiblePlaceName(country),
  };
  return cleaned.city || cleaned.region || cleaned.country ? cleaned : undefined;
}

function extractPlace(location: unknown): ExtractedPlace | undefined {
  const locationRecord = firstRecord(location);
  if (!locationRecord) return undefined;
  const address = firstRecord(locationRecord.address);
  if (!address) return undefined;

  const locality = nonEmptyString(address.addressLocality);
  const venueName = nonEmptyString(locationRecord.name);
  // B20-02 (A: event A20-02). schema.org `Place.name` IS the venue. When the
  // locality slot repeats it verbatim, the slot is holding a venue name rather
  // than a municipality, so the whole address record is unreliable: fail it
  // closed and let the lower layers of the `place:` chain answer instead of
  // publishing a hotel as a city. Failing the WHOLE branch (rather than
  // blanking only the city) is load-bearing — a leftover region/country is
  // still truthy, so the `??` chain would stop here and the body-text layer
  // would never run. This is a comparison of ONE record against ITSELF: no
  // host string, no word list, no gazetteer, so by construction it cannot fire
  // on a well-formed record, whose venue name and locality differ. Same policy
  // `findCurrentVenueClause` already applies to a venue-only clause below.
  if (locality && venueName && canonicalize(locality) === canonicalize(venueName)) {
    return undefined;
  }

  return sanitizePlace({
    city: locality,
    region: nonEmptyString(address.addressRegion),
    country: countryName(address.addressCountry),
  });
}

function numericValue(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * B4-11. schema.org MonetaryAmount: `{ currency, value }`, where `value` is
 * either a bare number or a nested QuantitativeValue (`{ value, minValue,
 * maxValue, unitText }`). Delegates the actual plausibility call to
 * `normalizeSalary` — this function's only job is reshaping JSON-LD's nesting
 * into that function's existing `StructuredSalaryInput`, never deciding on
 * its own whether a figure is believable.
 */
function extractBaseSalary(value: unknown): NormalizedSalary | null {
  const salaryRecord = firstRecord(value);
  if (!salaryRecord) return null;
  const currency = nonEmptyString(salaryRecord.currency);
  const valueRecord = firstRecord(salaryRecord.value);
  if (valueRecord) {
    return normalizeSalary({
      min: numericValue(valueRecord.minValue ?? valueRecord.value),
      max: numericValue(valueRecord.maxValue ?? valueRecord.value),
      currency,
      period: nonEmptyString(valueRecord.unitText),
    });
  }
  const bareValue = numericValue(salaryRecord.value);
  if (bareValue === undefined) return null;
  return normalizeSalary({ min: bareValue, max: bareValue, currency });
}

function extractOpportunity(node: JsonRecord): JsonLdOpportunity | null {
  const kind = opportunityKind(node["@type"]);
  if (!kind) return null;
  const validThrough = nonEmptyString(node.validThrough);
  const salary = extractBaseSalary(node.baseSalary);
  // B4-11. Lower-cased so a spec-conformant "FULL_TIME" renders through the
  // report's existing humanize() the same way Adzuna's own already-lowercase
  // "full_time" does — a presentation normalization, not a guess: it never
  // changes which employment type was stated, only its letter case.
  const employmentType = nonEmptyString(node.employmentType)?.toLowerCase();
  const url = kind === "job" ? nonEmptyString(node.url) : undefined;
  const description = nonEmptyString(node.description);
  const organization = kind === "job"
    ? (isRecord(node.hiringOrganization)
      ? nonEmptyString(node.hiringOrganization.name)
      : nonEmptyString(node.hiringOrganization))
    : undefined;
  const hiringOrganization = cleanJobSubtitlePart(organization);

  return {
    kind,
    name: nonEmptyString(node.name) ?? nonEmptyString(node.title),
    startDate: nonEmptyString(node.startDate),
    endDate: nonEmptyString(node.endDate),
    datePosted: nonEmptyString(node.datePosted),
    ...(validThrough ? { validThrough } : {}),
    place: extractPlace(node.location ?? node.jobLocation),
    eventAttendanceMode: nonEmptyString(node.eventAttendanceMode),
    ...(salary ? { salary } : {}),
    ...(employmentType ? { employmentType } : {}),
    ...(url ? { url } : {}),
    ...(description ? { description } : {}),
    ...(hiringOrganization ? { hiringOrganization } : {}),
  };
}

function walkJsonLd(value: unknown, output: JsonLdOpportunity[]): void {
  if (Array.isArray(value)) {
    for (const entry of value) walkJsonLd(entry, output);
    return;
  }
  if (!isRecord(value)) return;

  const opportunity = extractOpportunity(value);
  if (opportunity) output.push(opportunity);

  if ("@graph" in value) walkJsonLd(value["@graph"], output);
}

function attributeValue(attributes: string, name: string): string | undefined {
  const pattern = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = attributes.match(pattern);
  return match?.[1] ?? match?.[2] ?? match?.[3];
}

function decodeHtmlEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    quot: '"',
  };
  return value
    .replace(/&([a-z]+);/gi, (match, entity: string) => {
      return named[entity.toLowerCase()] ?? match;
    })
    .replace(/&#(x?[0-9a-f]+);/gi, (match, code: string) => {
      const radix = code[0]?.toLowerCase() === "x" ? 16 : 10;
      const digits = radix === 16 ? code.slice(1) : code;
      const point = Number.parseInt(digits, radix);
      return Number.isFinite(point) ? String.fromCodePoint(point) : match;
    });
}

function isoDate(year: number, month: number, day: number): string | undefined {
  const value = new Date(Date.UTC(year, month, day));
  if (
    value.getUTCFullYear() !== year ||
    value.getUTCMonth() !== month ||
    value.getUTCDate() !== day
  ) {
    return undefined;
  }
  return value.toISOString().slice(0, 10);
}

function parseDateRange(text: string): Pick<MetaOpportunityDetails, "start" | "end"> {
  const match = text.match(DATE_RANGE_PATTERN);
  if (!match) return {};

  const startMonth = MONTHS[match[1].toLowerCase()];
  const startDay = Number.parseInt(match[2], 10);
  const endMonth = match[3]
    ? MONTHS[match[3].toLowerCase()]
    : startMonth;
  const endDay = match[4] ? Number.parseInt(match[4], 10) : undefined;
  const year = Number.parseInt(match[5], 10);
  const start = isoDate(year, startMonth, startDay);
  if (!start) return {};

  const end = endDay === undefined ? undefined : isoDate(year, endMonth, endDay);
  return { start, end };
}

function parseCityRegion(
  text: string,
): Pick<MetaOpportunityDetails, "city" | "region"> {
  const segments = text
    .split("|")
    .map((segment) => segment.trim())
    .filter(Boolean);

  for (const segment of segments) {
    const withoutFormat = segment
      .replace(/\s*(?:\+|&)\s*(?:virtual|online)\s*$/i, "")
      .replace(/\s*[-–—]?\s*hybrid\s*$/i, "")
      .trim();
    const match = withoutFormat.match(
      /^([\p{L}][\p{L}\p{M} .'-]*?)\s*,\s*([\p{L}][\p{L}\p{M} .'-]*)$/u,
    );
    if (!match) continue;
    const city = match[1].trim();
    const region = match[2].trim();
    if (city && region) return { city, region };
  }
  return {};
}

function bodyText(html: string): string {
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  const body = bodyMatch?.[1] ?? html.replace(/<head\b[^>]*>[\s\S]*?<\/head\s*>/gi, " ");
  return decodeHtmlEntities(
    body
      .replace(/<(script|style|noscript|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
}

function findGazetteerMatch(
  text: string,
  values: readonly string[],
): string | undefined {
  const normalized = canonicalize(text);
  if (!normalized) return undefined;
  const padded = ` ${normalized} `;
  let best: { value: string; index: number; length: number } | undefined;

  for (const value of values) {
    const key = canonicalize(value);
    if (!key) continue;
    const index = padded.indexOf(` ${key} `);
    if (index < 0) continue;
    if (
      !best ||
      index < best.index ||
      (index === best.index && key.length > best.length)
    ) {
      best = { value, index, length: key.length };
    }
  }
  return best?.value;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stateCodeAfterCity(text: string, city: string): string | undefined {
  const flexibleCity = escapeRegExp(city).replace(/\s+/g, "\\s+");
  const pattern = new RegExp(
    `\\b${flexibleCity}\\s*,\\s*(${US_STATE_CODES.join("|")})\\b`,
    "i",
  );
  const code = text.match(pattern)?.[1];
  if (!code || code !== code.toUpperCase()) return undefined;
  return code;
}

/**
 * Country named immediately after the city, as in "Cologne, Germany" or
 * "Oldenburg (Germany)".
 *
 * Scanning the whole page for any country name pairs a city with whatever
 * country happens to be mentioned elsewhere: a titanium conference held in
 * Cologne whose abstract discusses production in China came out as
 * "Cologne / China". A wrong country is worse than no country, because the
 * user filters on it — so proximity is required, and an unmatched city simply
 * carries no country.
 */
function countryAfterCity(text: string, city: string): string | undefined {
  const flexibleCity = escapeRegExp(city).replace(/\s+/g, "\\s+");
  // Allow an intervening region/state token: "Cologne, NRW, Germany".
  const pattern = new RegExp(
    `\\b${flexibleCity}\\s*[,(\\-–]\\s*(?:[A-Za-z.\\s]{2,24}?\\s*[,(\\-–]\\s*)?(${COUNTRY_NAMES.map(
      (c) => escapeRegExp(c).replace(/\s+/g, "\\s+"),
    ).join("|")})\\b`,
    "i",
  );
  const matched = text.match(pattern)?.[1];
  if (!matched) return undefined;
  // Return the gazetteer's canonical spelling rather than the page's casing.
  const canonicalMatch = canonicalize(matched);
  return COUNTRY_NAMES.find((c) => canonicalize(c) === canonicalMatch);
}

// Common country spellings job boards use that the gazetteer lists formally.
const COUNTRY_ALIASES: Readonly<Record<string, string>> = {
  usa: "United States",
  us: "United States",
  "u s a": "United States",
  america: "United States",
  "united states of america": "United States",
  uk: "United Kingdom",
  "u k": "United Kingdom",
  england: "United Kingdom",
  uae: "United Arab Emirates",
  "south korea": "Korea",
  "republic of korea": "Korea",
};

function matchCountryToken(token: string): string | undefined {
  const key = canonicalize(token);
  if (!key) return undefined;
  if (COUNTRY_ALIASES[key]) return COUNTRY_ALIASES[key];
  return COUNTRY_NAMES.find((c) => canonicalize(c) === key);
}

/**
 * Parse a job board's structured location string.
 *
 * These arrive already comma-delimited — "Columbia, SC, United States",
 * "California, USA", "Mumbai" — so they should be split rather than scanned
 * as prose. Handing them to the free-text extractor left the whole string
 * sitting in `city`, which turned the location facet into buttons reading
 * "Columbia, SC, United States" next to "USA". Facet buttons are only useful
 * when the same place always produces the same label.
 *
 * Anything that cannot be classified is dropped rather than guessed: a wrong
 * city is worse than an absent one when the user filters on it.
 */
export function parseStructuredLocation(
  value: string | undefined,
): ExtractedPlace | undefined {
  if (!value) return undefined;
  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return undefined;

  let country: string | undefined;
  let region: string | undefined;

  // Trailing country, if present.
  const maybeCountry = matchCountryToken(parts[parts.length - 1]);
  if (maybeCountry) {
    country = maybeCountry;
    parts.pop();
  }

  // Trailing US state code ("SC"), which also implies the country.
  if (parts.length > 0) {
    const tail = parts[parts.length - 1];
    if ((US_STATE_CODES as readonly string[]).includes(tail.toUpperCase())) {
      region = tail.toUpperCase();
      country ??= "United States";
      parts.pop();
    }
  }

  // Whatever remains at the front is the city — but only when it reads like
  // one. "California" alone is a region, not a city, and must not become a
  // city button.
  const head = parts.length > 0 ? plausiblePlaceName(parts[0]) : undefined;
  const city =
    head && CONFERENCE_CITIES.some((c) => canonicalize(c) === canonicalize(head))
      ? head
      : undefined;
  if (!city && head && !region && parts.length === 1 && country) {
    // "California, USA" — the leading token is a region we cannot verify as a
    // city. Keep it as the region so the country still counts, without
    // claiming it is a city.
    region = head;
  }

  return sanitizePlace({ city, region, country });
}

/**
 * Preposition or venue verb that must sit near a candidate city before the
 * city is trusted as the venue — B4-02's own repro was "a titanium
 * conference held in Cologne whose abstract discusses production in China,"
 * where nothing checked that the mention of a gazetteer city was actually
 * describing the venue rather than something merely mentioned on the page.
 * The comment on `countryAfterCity` above already applies the same idea to
 * the COUNTRY half of a match; this extends it to the CITY half, which had
 * no equivalent check at all. Bare "in"/"at"/"near" count too — "the
 * industry summit in Chicago" has no stronger verb nearby and is a real,
 * already-passing case. Tested against the RAW (non-canonicalized) text so
 * `[^.]` still means a real sentence boundary — canonicalizing first would
 * strip every period, including ones from unrelated earlier sentences, and
 * let a cue from a different sentence bleed through.
 */
const CITY_PROXIMITY_CUE_RE =
  /\b(?:in|at|near|held|hosted|takes? place|taking place|venue|location|located)\b[^.]{0,40}$/i;

/**
 * A city immediately followed by ", ST" (a real, uppercase US state code) is
 * its own strong, structural locational signal — an address shape, not
 * prose — and should not additionally need a preposition or verb nearby.
 * Without this, a source's own structured field ("Chicago, IL + Virtual",
 * the shape ccfddl's `place` field actually takes) would wrongly lose its
 * region/country under the new cue requirement even though nothing about it
 * is ambiguous the way a bare prose mention is. Case matters: matching
 * lowercase would confuse the word "in" with the state code "IN".
 */
function hasTrailingStateCode(following: string): boolean {
  const match = following.match(
    new RegExp(`^\\s*,\\s*(${US_STATE_CODES.join("|")})\\b`),
  );
  return Boolean(match && match[1] === match[1].toUpperCase());
}

/**
 * B5-05/R2. A "past editions" framing satisfies `CITY_PROXIMITY_CUE_RE`
 * exactly the same way a current-venue statement does — "have previously
 * been held in Cologne" and "will be held in Lanzhou" both contain "held
 * in" — so the cue alone cannot tell a former host from the true venue.
 * Checked against the same `preceding` window `CITY_PROXIMITY_CUE_RE`
 * already scans: a marker anywhere in that lead-up, not only immediately
 * before the city, disqualifies the mention. Deliberately backward-looking
 * only (matching `CITY_PROXIMITY_CUE_RE`'s own direction) — a marker that
 * shows up later in the text, describing a different city mentioned after
 * it, must not retroactively taint an earlier, genuinely current mention.
 */
const HISTORICAL_FRAMING_RE =
  /\b(?:previous(?:ly)?|formerly|past edition|prior edition|used to (?:be|take place)|last (?:year'?s|time)|earlier editions?)\b/i;

/**
 * The other half of the same signal: a city sitting directly in front of a
 * parenthetical edition year ("Cologne, Germany (2008)") is itself a
 * past-edition shape — the form a "previously held in X (year), Y (year),
 * ..." list run takes — even when `HISTORICAL_FRAMING_RE`'s own marker word
 * sits further back than a later mention's own 120-char lead-up reaches.
 * Scoped to the text right after the match (through an optional country,
 * not through a sentence boundary) rather than requiring the parenthetical
 * immediately after the city itself, so "Cologne, Germany (2008)" still
 * matches with "Germany" sitting between the city and the year.
 */
const TRAILING_EDITION_YEAR_RE = /^[^.]{0,24}\(\s*(?:19|20)\d{2}\s*\)/;

/**
 * True when a city mention that would otherwise qualify (cued, or carrying a
 * trailing state code) actually names a FORMER host rather than the event's
 * current venue. Either signal is enough on its own; the real repro this was
 * built for trips both at once.
 */
function isHistoricalMention(preceding: string, following: string): boolean {
  return (
    HISTORICAL_FRAMING_RE.test(preceding) || TRAILING_EDITION_YEAR_RE.test(following)
  );
}

type CurrentVenueResult =
  | { status: "found"; place: ExtractedPlace }
  | { status: "none" | "ambiguous" };

const CURRENT_VENUE_CUE_RE =
  /\b(?:will be held in|will take place in|takes place in|will be hosted in|is scheduled to be held in)\s+([^,.!?;:|]+),\s*([^,.!?;:|]+)(?:,\s*([^,.!?;:|]+))?/gi;
const FACILITY_NAME_RE =
  /\b(?:center|centre|hotel|hall|campus|arena|resort|convention)\s*$/i;

/**
 * B7-03. A non-gazetteer city is only safe when an explicit current-event
 * action owns a complete city/region/country clause. This is deliberately
 * tri-state: ambiguity must suppress the older city-list fallback too.
 */
function findCurrentVenueClause(text: string): CurrentVenueResult {
  const candidates = new Map<string, ExtractedPlace>();

  for (const match of text.matchAll(CURRENT_VENUE_CUE_RE)) {
    const index = match.index ?? 0;
    const first = plausiblePlaceName(match[1]);
    const second = plausiblePlaceName(match[2]);
    const third = plausiblePlaceName(match[3]);
    if (!first || !second || (match[3] && !third)) continue;

    const country = matchCountryToken(third ?? second);
    if (!country) continue;
    const region = third ? second : undefined;
    // A venue-only phrase has no separately proved municipal WHERE value.
    if (FACILITY_NAME_RE.test(first)) continue;

    const end = index + match[0].length;
    const preceding = text.slice(Math.max(0, index - 120), index);
    const following = text.slice(end, end + 40);
    if (isHistoricalMention(preceding, following)) continue;

    const place = { city: first, region, country };
    const key = [
      canonicalize(place.city),
      canonicalize(place.region ?? ""),
      canonicalize(place.country),
    ].join("|");
    candidates.set(key, place);
  }

  if (candidates.size === 0) return { status: "none" };
  if (candidates.size > 1) return { status: "ambiguous" };
  return { status: "found", place: [...candidates.values()][0] };
}

/**
 * A23-03 / Ruling 62a — THE PLACE OWNERSHIP GUARD.
 *
 * The measured defect: `findVenueCity` accepts the first gazetteer city on the
 * page that sits after a locational cue, and NOTHING anywhere asks WHOSE city
 * it is. Four live pool rows were contaminated by that — a 2022 UN meeting in a
 * speaker biography (`flogen.org` → Geneva), an exhibitor's head office
 * (`storageusa` → Durham), a speaker's postal affiliation (`nanoge.org` →
 * Chicago) and the organiser's OTHER conference in a nav list (`sdle.co.il` →
 * Oslo, on a summit named for Turkey).
 *
 * The insight the design cost four rejected drafts: the wrong answers are never
 * "unowned text was read", they are "a city was read out of a sentence about a
 * DIFFERENT entity". So the gate is a co-witness test — is the EVENT ITSELF
 * present beside the city? — plus a small closed set of "this belongs to
 * someone else" markers. Nothing depends on finding a DOM block; the two drafts
 * that needed one destroyed three of the four correct pool values, because on
 * ordinary conference sites the event's own name lives in a banner image.
 *
 * Scope, and this is the largest blast-radius fact in the item: the guard runs
 * on the WHOLE-PAGE scan only. `extractPlaceFromText` is handed SHORT
 * STRUCTURED provider fields ("Chicago, IL + Virtual", `ccfddl.ts:147`) on which
 * no positive clause can fire, so it defaults to the exempt scope and keeps its
 * old contract exactly.
 */
interface PlaceOwnershipContext {
  /** `text` with abbreviation periods neutralised; same length, so shared indices. */
  collapsed: string;
  /** The item's own name, for the `P_name` co-witness clause. */
  eventName?: string;
  currentYear: number;
}

export type PlaceScanScope = "page" | "structured-field";

export interface PlaceScanOptions {
  /**
   * `page` runs the ownership guard, `structured-field` does not. The default
   * differs per entry point on purpose: `extractBodyTextPlace` IS the
   * whole-page scan and fails safe into the guard, while
   * `extractPlaceFromText`'s callers pass a provider's own short place string.
   */
  scope?: PlaceScanScope;
  eventName?: string;
  /** Injectable clock — `P_date` and `N_pastyear` both read the current year. */
  now?: Date;
}

const PLACE_OWNER_LOOKBEHIND = 200;
const PLACE_OWNER_LOOKAHEAD = 120;
/** `P_venue` and `N_seat` both read only the words immediately before the city. */
const PLACE_OWNER_ADJACENT = 40;

/**
 * A period that is not a sentence end is an ABBREVIATION dot, and the shipped
 * `[^.]{0,N}$` window style cannot cross one. B measured the cost: "will be held
 * Oct. 11-14 in Denver" and "Based in Durham, N.C." both carry one, and a first
 * build of this guard silenced `npaonline.org`'s CORRECT, current Denver
 * because the clause was cut at "Oct.". Collapsing to a space rather than
 * deleting keeps the string length identical, so every index computed against
 * the raw text still points at the same character here.
 */
function collapseAbbreviationPeriods(text: string): string {
  return text.replace(/\.(?![ \t]+[A-Z])(?!$)/g, " ");
}

const OWNER_MONTH_DAY_RE = new RegExp(
  `\\b(?:${MONTH_PATTERN})\\b\\.?\\s{0,2}\\d{1,2}\\b|\\b\\d{1,2}\\s{0,2}(?:${MONTH_PATTERN})\\b`,
  "i",
);

const OWNER_YEAR_RE = /\b(20\d{2})\b/g;

/**
 * `P_date` — the event's own dates sit next to its own venue: "OCTOBER 12-15,
 * 2026 Huntington Place Detroit, MI". A month-day token alone is not enough (a
 * biography's "in February 2022" has one); it must be joined by a year that has
 * not already passed.
 */
function hasOwnDateWitness(window: string, currentYear: number): boolean {
  if (!OWNER_MONTH_DAY_RE.test(window)) return false;
  for (const match of window.matchAll(OWNER_YEAR_RE)) {
    if (Number(match[1]) >= currentYear) return true;
  }
  return false;
}

/**
 * Words that are in every event's name and therefore witness nothing. Without
 * this stop-list `P_name` matches "conference" on every page and becomes a
 * no-op that HIDES the other clauses' failures — B measured it as the clause's
 * single most important boundary.
 */
const GENERIC_EVENT_NAME_TOKENS = new Set([
  "annual", "asia", "association", "biennial", "centre", "center", "college",
  "conference", "conferences", "congress", "convention", "days", "department",
  "edition", "europe", "european", "event", "events", "exhibition", "expo",
  "festival", "forum", "global", "hybrid", "institute", "international",
  "laboratory", "meeting", "meetings", "national", "online", "program",
  "programme", "school", "seminar", "series", "session", "sessions", "show",
  "society", "summit", "symposium", "university", "virtual", "webinar", "week",
  "workshop", "world",
]);

/**
 * `P_name` — a distinctive token of the item's OWN name in the window. The
 * ≥4-character floor is not cosmetic: "NPA" and "SSI" as bare tokens match
 * inside ordinary words and would admit everything.
 */
function hasOwnNameWitness(window: string, eventName: string | undefined): boolean {
  if (!eventName) return false;

  for (const token of eventName.split(/[^A-Za-z0-9]+/)) {
    if (token.length < 4) continue;
    if (/^\d+$/.test(token)) continue;
    if (GENERIC_EVENT_NAME_TOKENS.has(token.toLowerCase())) continue;
    if (new RegExp(`\\b${escapeRegExp(token)}\\b`, "i").test(window)) return true;
  }
  return false;
}

/**
 * `P_venue` — a venue proper noun directly in front of the city. It must NOT
 * contain `university`, `institute`, `college`, `school`, `department` or
 * `laboratory`: those are exactly the AFFILIATION shape, and including them was
 * what killed draft 3 and left "Illinois Institute of Technology, Chicago"
 * reading as a venue.
 */
const VENUE_PROPER_NOUN_RE =
  /\b(?:convention|congres|congress|exhibition|expo|centre|center|hotel|hall|arena|resort|stadium|pavilion|palace|auditorium|messe|fairground|plaza|theatre|place)\b/i;

/** `N_seat` — an exhibitor's or sponsor's head office, not the event's venue. */
const ORG_SEAT_RE =
  /\b(?:based|headquartered|head office|hq|offices|branch|subsidiary|founded|incorporated|registered)\b/i;

const OTHER_EVENT_WORDS = new Set([
  "conference", "congress", "day", "days", "expo", "forum", "meeting", "show",
  "summit", "symposium", "week", "weeks",
]);

/**
 * `N_otherevent` — the city opens ANOTHER event's name, the shape an
 * organiser's nav list of its other conferences takes ("7th Oslo Battery Days
 * Conference"). It is START-anchored and stops at the first token that is not
 * part of a proper name: B measured the unanchored form breaking 10 of 41 rows
 * and MOVING `battery-power.eu` off its correct Aachen. Requiring an initial
 * capital is what separates "Oslo Battery Days" from the innocent "Kyoto for
 * five days of talks".
 */
function namesAnotherEvent(following: string): boolean {
  const run = following.match(
    /^[ \t]*[A-Za-z][A-Za-z&'’-]*(?:[ \t]+[A-Za-z][A-Za-z&'’-]*){0,3}/,
  );
  if (!run) return false;

  for (const token of run[0].trim().split(/[ \t]+/)) {
    if (!/^[A-Z]/.test(token)) return false;
    if (OTHER_EVENT_WORDS.has(token.toLowerCase())) return true;
  }
  return false;
}

/** The run of text around the city, cut at real sentence and list boundaries. */
function clauseAround(collapsed: string, index: number, end: number): string {
  const from = Math.max(0, index - PLACE_OWNER_LOOKBEHIND);
  const to = Math.min(collapsed.length, end + PLACE_OWNER_LOOKAHEAD);
  const before = collapsed.slice(from, index);
  const after = collapsed.slice(end, to);
  const openedAt = before.search(/[.!?;|•\n][^.!?;|•\n]*$/);
  const closesAt = after.search(/[.!?;|•\n]/);
  return (
    (openedAt >= 0 ? before.slice(openedAt + 1) : before) +
    collapsed.slice(index, end) +
    (closesAt >= 0 ? after.slice(0, closesAt) : after)
  );
}

/**
 * `N_pastyear` — every year in the city's OWN clause has already gone by, so
 * the sentence is about a finished event. Deliberately scoped to one clause: a
 * copyright year or a past-edition link sitting near a correct current venue
 * would trip a window-wide form. B measured the wider scope as changing zero
 * rows on its corpus and recorded that the narrowing is therefore UNPROVED
 * there — it is kept on principle, not on evidence.
 */
function isPastEditionClause(clause: string, currentYear: number): boolean {
  const years = [...clause.matchAll(OWNER_YEAR_RE)].map((match) => Number(match[1]));
  return years.length > 0 && years.every((year) => year < currentYear);
}

/**
 * The six clauses, assembled. NEGATIVES ARE EVALUATED AFTER THE POSITIVES AND
 * THEY VETO. This is the single easiest line in the item to mis-read as
 * `positive || !negative`, and B measured that misreading: it brings SIX rows
 * back wrong and re-opens three of the four contaminations.
 */
function ownsVenueMention(
  ownership: PlaceOwnershipContext,
  index: number,
  end: number,
): boolean {
  const { collapsed, currentYear } = ownership;
  const before = collapsed.slice(Math.max(0, index - PLACE_OWNER_LOOKBEHIND), index);
  const adjacent = before.slice(-PLACE_OWNER_ADJACENT);
  const after = collapsed.slice(end, end + PLACE_OWNER_LOOKAHEAD);
  const window = before + collapsed.slice(index, end) + after;

  const positive =
    hasOwnDateWitness(window, currentYear) ||
    hasOwnNameWitness(window, ownership.eventName) ||
    VENUE_PROPER_NOUN_RE.test(adjacent);
  if (!positive) return false;

  if (ORG_SEAT_RE.test(adjacent)) return false;
  if (namesAnotherEvent(after)) return false;
  if (isPastEditionClause(clauseAround(collapsed, index, end), currentYear)) {
    return false;
  }
  return true;
}

function placeOwnershipContext(
  text: string,
  options: PlaceScanOptions,
  fallbackScope: PlaceScanScope,
): PlaceOwnershipContext | undefined {
  if ((options.scope ?? fallbackScope) !== "page") return undefined;
  return {
    collapsed: collapseAbbreviationPeriods(text),
    eventName: options.eventName,
    currentYear: (options.now ?? new Date()).getFullYear(),
  };
}

/**
 * Same ranking as findGazetteerMatch (earliest qualifying position, longest
 * name on a tie) but a city only qualifies if some mention of it — not
 * necessarily its first — is preceded by a locational cue or immediately
 * followed by a state code. Checking every mention, not only the first, is
 * what lets a real, later-mentioned, qualifying city beat an earlier,
 * unqualified one: the first name on the page is not necessarily the one
 * describing the venue. If no gazetteer city qualifies anywhere, this
 * returns undefined — converting today's wrong, confident answer into an
 * honest, absent one is real progress even when it falls short of finding
 * the true venue (see B4-02's own note on gazetteer coverage, a separate,
 * open-ended limitation this does not attempt to fix).
 */
function findVenueCity(
  text: string,
  cities: readonly string[],
  ownership?: PlaceOwnershipContext,
): string | undefined {
  let best: { value: string; index: number; length: number } | undefined;

  for (const value of cities) {
    const flexible = escapeRegExp(value).replace(/\s+/g, "\\s+");
    const pattern = new RegExp(`\\b${flexible}\\b`, "gi");
    for (const match of text.matchAll(pattern)) {
      const index = match.index ?? 0;
      const end = index + match[0].length;
      const preceding = text.slice(Math.max(0, index - 120), index);
      const following = text.slice(end, end + 12);
      // B5-05/R2. A past-edition mention can satisfy the cue/state-code
      // check below exactly the way a current-venue mention does — checked
      // first, against a wider following-text window than the state-code
      // check needs, so a qualifying-looking mention that is actually
      // historical is skipped rather than accepted. `continue`, not
      // `break`: a LATER mention of this same city name may still be a
      // genuine, non-historical cue.
      if (isHistoricalMention(preceding, text.slice(end, end + 40))) continue;
      if (CITY_PROXIMITY_CUE_RE.test(preceding) || hasTrailingStateCode(following)) {
        // A23-03 / Ruling 62a. The guard lives HERE, inside the acceptance
        // loop, not at the caller: at the caller it cannot see which mention
        // won, so it could only discard the whole answer and would lose the
        // "first admissible mention" behaviour that keeps Lyon when a page
        // carries a second, rival venue statement. `continue`, not `break`,
        // for the same reason the historical check uses it — a LATER mention
        // of this same city may be the owned one.
        if (ownership && !ownsVenueMention(ownership, index, end)) continue;
        if (
          !best ||
          index < best.index ||
          (index === best.index && value.length > best.length)
        ) {
          best = { value, index, length: value.length };
        }
        break;
      }
    }
  }
  return best?.value;
}

export function extractBodyTextPlace(
  html: string,
  options: PlaceScanOptions = {},
): ExtractedPlace | undefined {
  const text = bodyText(html);
  const currentVenue = findCurrentVenueClause(text);
  if (currentVenue.status === "found") return currentVenue.place;
  if (currentVenue.status === "ambiguous") return undefined;

  // A23-03: this function IS the whole-page scan, so it fails safe INTO the
  // ownership guard. Only a caller that knows it holds a short structured
  // provider field may opt out.
  const ownership = placeOwnershipContext(text, options, "page");
  const city = findVenueCity(text, CONFERENCE_CITIES, ownership);
  if (!city) return undefined;

  const region = stateCodeAfterCity(text, city);
  const country = region ? "United States" : countryAfterCity(text, city);
  return {
    city,
    region,
    country,
  };
}

// A country is only trustworthy on its own when the page says it is the venue.
// Without a cue, "China" in a discussion of titanium production becomes the
// event's location.
const VENUE_CUE_RE =
  /\b(?:held|hosted|takes? place|taking place|venue|location|located)\b[^.]{0,40}$/i;

/**
 * A23-03 / Ruling 62a. This entry point defaults to the EXEMPT scope: its only
 * shipped caller hands it a provider's own short structured place string
 * ("Chicago, IL + Virtual", `ccfddl.ts:147`), on which no positive ownership
 * clause can fire, so guarding it would silence a field that was never
 * ambiguous. A caller that passes a whole page must say so — and when it does,
 * the bare-country arm below is gated by the SAME test, because Ruling 26's
 * lesson applies here exactly: a city the guard just rejected must not be
 * allowed to publish its COUNTRY through the back door.
 */
export function extractPlaceFromText(
  text: string,
  options: PlaceScanOptions = {},
): ExtractedPlace | undefined {
  const scope = options.scope ?? "structured-field";
  const cityPlace = extractBodyTextPlace(text, { ...options, scope });
  if (cityPlace) return cityPlace;

  const body = bodyText(text);
  const country = findGazetteerMatch(body, COUNTRY_NAMES);
  if (!country) return undefined;

  const index = canonicalize(body).indexOf(canonicalize(country));
  if (index < 0) return undefined;
  const preceding = canonicalize(body).slice(Math.max(0, index - 60), index);
  if (!VENUE_CUE_RE.test(preceding)) return undefined;

  const ownership = placeOwnershipContext(body, options, "structured-field");
  if (ownership) {
    const rawIndex = body.toLowerCase().indexOf(country.toLowerCase());
    if (rawIndex < 0) return undefined;
    if (!ownsVenueMention(ownership, rawIndex, rawIndex + country.length)) {
      return undefined;
    }
  }
  return { country };
}

function jsonLdBlocks(html: string): string[] {
  const blocks: string[] = [];
  const scriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;

  for (const match of html.matchAll(scriptPattern)) {
    const type = attributeValue(match[1] ?? "", "type")
      ?.split(";")[0]
      .trim()
      .toLowerCase();
    if (type === "application/ld+json") blocks.push(match[2] ?? "");
  }
  return blocks;
}

export function extractJsonLdOpportunities(html: string): JsonLdOpportunity[] {
  const opportunities: JsonLdOpportunity[] = [];

  for (const block of jsonLdBlocks(html)) {
    try {
      walkJsonLd(JSON.parse(block), opportunities);
    } catch {
      // A malformed block must not discard valid JSON-LD elsewhere on the page.
    }
  }

  return opportunities;
}

export function extractOpenGraphTags(html: string): OpenGraphTags {
  const tags: OpenGraphTags = {};
  const metaPattern = /<meta\b([^>]*)\/?>/gi;

  for (const match of html.matchAll(metaPattern)) {
    const attributes = match[1] ?? "";
    const key = (
      attributeValue(attributes, "property") ??
      attributeValue(attributes, "name")
    )?.toLowerCase();
    const content = attributeValue(attributes, "content");
    if (!key || content === undefined) continue;

    const value = decodeHtmlEntities(content).trim();
    if (!value) continue;
    if (key === "og:title" && !tags.title) tags.title = value;
    if (key === "og:description" && !tags.description) {
      tags.description = value;
    }
    if (key === "og:site_name" && !tags.siteName) tags.siteName = value;
  }

  return tags;
}

export function extractMetaOpportunityDetails(
  html: string,
): MetaOpportunityDetails {
  const tags = extractOpenGraphTags(html);
  const text = [tags.title, tags.description, tags.siteName]
    .filter((value): value is string => Boolean(value))
    .join(" | ");

  return {
    ...parseDateRange(text),
    ...parseCityRegion(text),
    isOnline: /\b(?:virtual|online|hybrid)\b/i.test(text),
  };
}

export function extractOpportunityPageDetails(
  html: string,
  kind?: JsonLdOpportunity["kind"],
  options: PlaceScanOptions = {},
): OpportunityPageDetails {
  const jsonLd = extractJsonLdOpportunities(html);
  const typed = kind ? jsonLd.filter((item) => item.kind === kind) : [];
  const structured = kind
    ? typed[0]
    : jsonLd[0];
  const openGraph = extractOpenGraphTags(html);
  const meta = extractMetaOpportunityDetails(html);
  const metaPlace =
    meta.city || meta.region
      ? { city: meta.city, region: meta.region }
      : undefined;
  const attendanceMode = structured?.eventAttendanceMode?.toLowerCase() ?? "";

  return {
    // Keep the two name authorities separate. An untyped og:title is often an
    // article headline, whereas a matching Event record owns its name.
    ...(kind === "event" && structured?.name
      ? { typedOpportunityName: structured.name }
      : {}),
    ...(openGraph.title ? { openGraphTitle: openGraph.title } : {}),
    ...(openGraph.description ? { openGraphDescription: openGraph.description } : {}),
    // A page with several Event records does not prove which description owns
    // the selected result.  Fail closed instead of choosing the first one.
    ...(kind === "event" && typed.length === 1 && typed[0]?.description
      ? { typedOpportunityDescription: typed[0].description }
      : {}),
    startDate: structured?.startDate ?? meta.start,
    endDate: structured?.endDate ?? meta.end,
    datePosted: structured?.datePosted,
    // Sanitize at the boundary so every layer — JSON-LD, meta tags, body text
    // — is held to the same "is this actually a place name" standard before it
    // can become a facet button.
    place:
      sanitizePlace(structured?.place) ??
      sanitizePlace(metaPlace) ??
      sanitizePlace(extractBodyTextPlace(html, { ...options, scope: "page" })),
    isOnline:
      meta.isOnline ||
      attendanceMode.includes("online") ||
      attendanceMode.includes("mixed"),
  };
}
