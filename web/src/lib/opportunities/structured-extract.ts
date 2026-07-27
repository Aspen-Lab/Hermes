import { canonicalize } from "@/lib/scoring/term-expand";
import type { OpportunityPlace } from "@/types";

export type ExtractedPlace = OpportunityPlace;

export interface JsonLdOpportunity {
  kind: "event" | "job";
  name?: string;
  startDate?: string;
  endDate?: string;
  place?: ExtractedPlace;
  eventAttendanceMode?: string;
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
  name?: string;
  startDate?: string;
  endDate?: string;
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

function extractPlace(location: unknown): ExtractedPlace | undefined {
  const locationRecord = firstRecord(location);
  if (!locationRecord) return undefined;
  const address = firstRecord(locationRecord.address);
  if (!address) return undefined;

  const place: ExtractedPlace = {
    city: nonEmptyString(address.addressLocality),
    region: nonEmptyString(address.addressRegion),
    country: countryName(address.addressCountry),
  };
  return place.city || place.region || place.country ? place : undefined;
}

function extractOpportunity(node: JsonRecord): JsonLdOpportunity | null {
  const kind = opportunityKind(node["@type"]);
  if (!kind) return null;

  return {
    kind,
    name: nonEmptyString(node.name),
    startDate: nonEmptyString(node.startDate),
    endDate: nonEmptyString(node.endDate),
    place: extractPlace(node.location),
    eventAttendanceMode: nonEmptyString(node.eventAttendanceMode),
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

export function extractBodyTextPlace(html: string): ExtractedPlace | undefined {
  const text = bodyText(html);
  const city = findGazetteerMatch(text, CONFERENCE_CITIES);
  if (!city) return undefined;

  const region = stateCodeAfterCity(text, city);
  const country = region
    ? "United States"
    : findGazetteerMatch(text, COUNTRY_NAMES);
  return {
    city,
    region,
    country,
  };
}

export function extractPlaceFromText(text: string): ExtractedPlace | undefined {
  const cityPlace = extractBodyTextPlace(text);
  if (cityPlace) return cityPlace;
  const country = findGazetteerMatch(bodyText(text), COUNTRY_NAMES);
  return country ? { country } : undefined;
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
): OpportunityPageDetails {
  const jsonLd = extractJsonLdOpportunities(html);
  const structured = kind
    ? jsonLd.find((item) => item.kind === kind)
    : jsonLd[0];
  const openGraph = extractOpenGraphTags(html);
  const meta = extractMetaOpportunityDetails(html);
  const metaPlace =
    meta.city || meta.region
      ? { city: meta.city, region: meta.region }
      : undefined;
  const attendanceMode = structured?.eventAttendanceMode?.toLowerCase() ?? "";

  return {
    name: structured?.name ?? openGraph.title,
    startDate: structured?.startDate ?? meta.start,
    endDate: structured?.endDate ?? meta.end,
    place: structured?.place ?? metaPlace ?? extractBodyTextPlace(html),
    isOnline:
      meta.isOnline ||
      attendanceMode.includes("online") ||
      attendanceMode.includes("mixed"),
  };
}
