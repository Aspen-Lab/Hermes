import { stripHtml } from "./shared";
import { sanitizePlace } from "./structured-extract";

export type VisaState = "sponsors" | "not-stated" | "wont-sponsor";

export interface VisaAssessment {
  state: VisaState;
  evidence?: string;
  country?: string;
}

type VisaScope = "us" | "uk" | "eu" | "canada" | "australia" | "generic";

interface PhraseSet {
  sponsors: readonly RegExp[];
  wontSponsor: readonly RegExp[];
}

const EU_COUNTRIES = new Set(
  [
    "Austria",
    "Belgium",
    "Bulgaria",
    "Croatia",
    "Cyprus",
    "Czechia",
    "Czech Republic",
    "Denmark",
    "Estonia",
    "Finland",
    "France",
    "Germany",
    "Greece",
    "Hungary",
    "Ireland",
    "Italy",
    "Latvia",
    "Lithuania",
    "Luxembourg",
    "Malta",
    "Netherlands",
    "Poland",
    "Portugal",
    "Romania",
    "Slovakia",
    "Slovenia",
    "Spain",
    "Sweden",
  ].map((country) => country.toLowerCase()),
);

const GENERIC_PHRASES: PhraseSet = {
  sponsors: [
    /\b(?:visa|work permit|immigration)\s+sponsor(?:ship|ing)?\b[^.!?]{0,45}\b(?:available|provided|offered|supported)\b/i,
    /\b(?:we|the employer|the company|the university|the organisation|the organization)\s+(?:can|may|will)\s+(?:provide|offer|support)\b[^.!?]{0,45}\b(?:visa|work permit|immigration)\s+sponsor(?:ship|ing)?\b/i,
    /\b(?:we|the employer|the company|the university|the organisation|the organization)\s+(?:(?:can|may|will)\s+)?sponsor(?:s|ed|ing)?\s+(?:work\s+)?visas?\b/i,
    /\b(?:provide|offer)\b[^.!?]{0,30}\b(?:visa|work permit)\s+sponsorship\b/i,
  ],
  wontSponsor: [
    /\b(?:no|not|unable to|cannot|can't|will not|won't|does not|do not)\b[^.!?]{0,45}\b(?:provide|offer|support|consider)?\s*(?:visa|work permit|immigration)\s+sponsor(?:ship|ing)?\b/i,
    /\b(?:visa|work permit|immigration)\s+sponsor(?:ship|ing)?\b[^.!?]{0,45}\b(?:not available|not provided|unavailable)\b/i,
    /\bwithout\s+(?:current or future\s+)?(?:visa|employment|work)\s+sponsorship\b/i,
  ],
};

const COUNTRY_PHRASES: Record<Exclude<VisaScope, "generic">, PhraseSet> = {
  us: {
    sponsors: [
      /\bH\s*[-\s]?\s*1B\b[^.!?]{0,45}\b(?:sponsor(?:ship|ing)?|transfer|support)\b/i,
      /\b(?:sponsor(?:ship|ing)?|transfer|support)\b[^.!?]{0,45}\bH\s*[-\s]?\s*1B\b/i,
    ],
    wontSponsor: [
      /\b(?:no|not|cannot|can't|will not|won't|does not|do not|unable to)\b[^.!?]{0,45}\b(?:sponsor|transfer|support)\b[^.!?]{0,30}\bH\s*[-\s]?\s*1B\b/i,
      /\bH\s*[-\s]?\s*1B\b[^.!?]{0,45}\b(?:not available|not provided|unavailable)\b/i,
      /\b(?:must|need to|required to)\s+(?:already\s+)?be\s+(?:currently\s+)?(?:legally\s+)?authori[sz]ed\s+to\s+work\s+in\s+(?:the\s+)?(?:US|U\.S\.|USA|United States)\b/i,
    ],
  },
  uk: {
    sponsors: [
      /\bSkilled\s+Worker\s+visa\b[^.!?]{0,45}\b(?:sponsor(?:ship|ing)?|support|available|eligible)\b/i,
      /\b(?:provide|issue|offer)\b[^.!?]{0,35}\bcertificate\s+of\s+sponsorship\b/i,
    ],
    wontSponsor: [
      /\b(?:must|need to|required to)\s+(?:already\s+)?(?:have|hold|possess)\s+(?:the\s+)?right\s+to\s+work\s+in\s+(?:the\s+)?(?:UK|United Kingdom)\b/i,
      /\brequires?\s+(?:existing|current)\s+(?:work\s+)?authori[sz]ation(?:\s+to\s+work\s+in\s+(?:the\s+)?(?:UK|United Kingdom))?\b/i,
      /\b(?:cannot|can't|will not|won't|do not|does not|unable to)\b[^.!?]{0,40}\b(?:Skilled\s+Worker\s+visa|certificate\s+of\s+sponsorship)\b/i,
      /\bSkilled\s+Worker\s+visa\b[^.!?]{0,45}\b(?:not available|not provided|unavailable)\b/i,
    ],
  },
  eu: {
    sponsors: [
      /\bEU\s+Blue\s+Card\b[^.!?]{0,45}\b(?:support|sponsor(?:ship|ing)?|assist|eligible)\b/i,
      /\b(?:support|assist|sponsor)\b[^.!?]{0,40}\bEU\s+Blue\s+Card\b/i,
    ],
    wontSponsor: [
      /\b(?:must|need to|required to)\s+(?:already\s+)?(?:have|hold|possess)\b[^.!?]{0,30}\b(?:EU|EEA)\s+(?:work\s+)?authori[sz]ation\b/i,
      /\b(?:must|need to|required to)\s+be\s+(?:already\s+)?eligible\s+to\s+work\s+in\s+(?:the\s+)?(?:EU|EEA)\b/i,
    ],
  },
  canada: {
    sponsors: [
      /\bLMIA\b[^.!?]{0,45}\b(?:support|sponsor(?:ship|ing)?|provided|available)\b/i,
      /\b(?:support|provide|offer)\b[^.!?]{0,40}\b(?:LMIA|Canadian\s+work\s+permit)\b/i,
    ],
    wontSponsor: [
      /\b(?:must|need to|required to)\s+(?:already\s+)?be\s+(?:legally\s+)?entitled\s+to\s+work\s+in\s+Canada\b/i,
      /\b(?:must|need to|required to)\s+(?:already\s+)?(?:have|hold)\s+(?:a\s+)?valid\s+Canadian\s+work\s+permit\b/i,
    ],
  },
  australia: {
    sponsors: [
      /\b(?:subclass\s+482|TSS)\b[^.!?]{0,45}\b(?:visa\s+)?sponsor(?:ship|ing)?\b/i,
      /\b(?:sponsor(?:ship|ing)?|support)\b[^.!?]{0,40}\b(?:subclass\s+482|TSS)\b/i,
    ],
    wontSponsor: [
      /\b(?:must|need to|required to)\s+(?:already\s+)?(?:have|hold|possess)\s+(?:full\s+)?(?:Australian\s+)?working\s+rights\b/i,
      /\b(?:must|need to|required to)\s+be\s+(?:already\s+)?authori[sz]ed\s+to\s+work\s+in\s+Australia\b/i,
    ],
  },
};

const US_INTERNSHIP_RE =
  /\b(?:intern(?:ship)?|co[- ]?op|student\s+researcher|summer\s+placement)\b/i;
const CPT_OPT_RE = /\b(?:CPT|OPT)\b/i;
const CPT_OPT_ELIGIBILITY_RE =
  /\b(?:eligible\s+for|using|on|with)\s+(?:CPT|OPT)(?:\s*(?:\/|or|and)\s*(?:CPT|OPT))?\b|\b(?:CPT|OPT)(?:\s*(?:\/|or|and)\s*(?:CPT|OPT))?\s+(?:(?:students?|candidates?|holders?)\s+)?(?:are\s+)?(?:eligible|accepted|welcome)\b|\b(?:students?|candidates?)\b[^.!?]{0,30}\b(?:CPT|OPT)\b[^.!?]{0,30}\b(?:may|can)\s+(?:apply|work)\b/i;
const NEGATED_CPT_OPT_RE =
  /\b(?:not|ineligible|cannot|can't|unavailable|no)\b[^.!?]{0,40}\b(?:CPT|OPT)\b|\b(?:CPT|OPT)\b[^.!?]{0,40}\b(?:not|ineligible|cannot|can't|unavailable)\b/i;

function normalizeCountry(country: string | undefined): string | undefined {
  const trimmed = country?.trim();
  if (!trimmed) return undefined;
  const key = trimmed
    .toLowerCase()
    .replace(/[._]/g, "")
    .replace(/\s+/g, " ");

  if (["great britain", "britain"].includes(key)) {
    return "United Kingdom";
  }
  if (["eu", "european union", "eea", "european economic area"].includes(key)) {
    return "European Union";
  }
  return sanitizePlace({ country: trimmed })?.country;
}

function visaScope(country: string | undefined): VisaScope {
  const key = country?.toLowerCase();
  if (country === "United States") return "us";
  if (country === "United Kingdom") return "uk";
  if (country === "European Union" || (key && EU_COUNTRIES.has(key))) return "eu";
  if (country === "Canada") return "canada";
  if (country === "Australia") return "australia";
  return "generic";
}

function sentencesFromPosting(text: string): string[] {
  return stripHtml(text)
    .split(/\r?\n+|(?<=[.!?])\s+/)
    .map((sentence) => sentence.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function firstEvidence(
  sentences: readonly string[],
  patterns: readonly RegExp[],
): string | undefined {
  for (const sentence of sentences) {
    if (patterns.some((pattern) => pattern.test(sentence))) return sentence;
  }
  return undefined;
}

function withCountry(
  assessment: Omit<VisaAssessment, "country">,
  country: string | undefined,
): VisaAssessment {
  return country ? { ...assessment, country } : assessment;
}

export function extractVisaState(
  postingText: string,
  jobCountry?: string,
): VisaAssessment {
  const country = normalizeCountry(jobCountry);
  const scope = visaScope(country);
  const sentences = sentencesFromPosting(postingText);
  const scoped = scope === "generic" ? undefined : COUNTRY_PHRASES[scope];
  const wontEvidence = firstEvidence(sentences, [
    ...(scoped?.wontSponsor ?? []),
    ...GENERIC_PHRASES.wontSponsor,
  ]);
  const sponsorEvidence = firstEvidence(sentences, [
    ...(scoped?.sponsors ?? []),
    ...GENERIC_PHRASES.sponsors,
  ]);

  if (scope === "us" && wontEvidence && US_INTERNSHIP_RE.test(postingText)) {
    const cptOptEvidence = sentences.find(
      (sentence) =>
        CPT_OPT_RE.test(sentence) &&
        CPT_OPT_ELIGIBILITY_RE.test(sentence) &&
        !NEGATED_CPT_OPT_RE.test(sentence),
    );
    if (cptOptEvidence) {
      // CPT/OPT is work authorisation, not employer sponsorship. Keep the
      // state neutral while preventing an eligible US internship from being
      // hidden by a sponsorship refusal.
      return withCountry(
        { state: "not-stated", evidence: cptOptEvidence },
        country,
      );
    }
  }

  // Explicit refusal wins when a posting contains both general company policy
  // and a role-specific requirement for existing authorisation.
  if (wontEvidence) {
    return withCountry(
      { state: "wont-sponsor", evidence: wontEvidence },
      country,
    );
  }
  if (sponsorEvidence) {
    return withCountry(
      { state: "sponsors", evidence: sponsorEvidence },
      country,
    );
  }
  return withCountry({ state: "not-stated" }, country);
}
