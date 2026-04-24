// ── Paper ──

export type PaperSource = "arxiv" | "neurIPS" | "iclr" | "icml" | "chi" | "other";

export type ItemFeedback = "liked" | "saved" | "notInterested" | "moreLikeThis";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  relevanceReason: string;
  venue: string;
  source: PaperSource;
  summaryIntro: string;
  summaryExperimentKeywords: string[];
  summaryResultDiscussion: string;
  linkPaper?: string;
  linkArxiv?: string;
  linkScholar?: string;
  linkCode?: string;
  publishedDate?: string;
  isSaved: boolean;
  feedback?: ItemFeedback;
  relevanceScore?: number;
}

// ── Event ──

export type EventType = "conference" | "workshop" | "seminar" | "meetup";

export interface Event {
  id: string;
  name: string;
  type: EventType;
  date: string;
  endDate?: string;
  location: string;
  isOnline: boolean;
  deadline?: string;
  shortDescription: string;
  relevanceReason: string;
  linkRegistration?: string;
  linkOfficial?: string;
  relevanceScore?: number;
}

// ── Job ──

export interface Job {
  id: string;
  roleTitle: string;
  companyOrLab: string;
  location: string;
  isRemote: boolean;
  keyRequirements: string[];
  matchReason: string;
  linkPosting?: string;
  postedDate?: string;
  relevanceScore?: number;
}

// ── User Profile ──

export type CareerStage =
  | "PhD Year 1"
  | "PhD Year 2"
  | "PhD Year 3"
  | "PhD Year 4"
  | "PhD Year 5"
  | "PhD Year 6"
  | "Postdoc"
  | "Research Scientist";

export type IndustryAcademiaPreference =
  | "academia"
  | "industry"
  | "both"
  | "startups"
  | "bigTech";

export type DigestChannel = "inapp" | "email" | "both";
export type DigestFrequency = "daily" | "weekdays" | "weekly" | "off";

export interface UserProfile {
  displayName: string;
  researchTopics: string[];
  preferredVenues: string[];
  careerStage: CareerStage;
  industryVsAcademia: IndustryAcademiaPreference;
  locationPreferences: string[];
  preferredMethods: string[];
  phdYear?: number;
  // Daily-digest preferences. `digestHourLocal` is interpreted in
  // `digestTimezone` (IANA name) by the scheduling cron.
  digestEnabled: boolean;
  digestHourLocal: number;
  digestTimezone: string;
  digestChannel: DigestChannel;
  digestFrequency: DigestFrequency;
}

export const defaultProfile: UserProfile = {
  displayName: "Hermes Member",
  researchTopics: [
    "electroplating LCO",
    "battery cathode materials",
    "LCO cathode",
  ],
  preferredVenues: [
    "J. Electrochem. Soc.",
    "Adv. Energy Mater.",
    "Electrochim. Acta",
    "J. Power Sources",
    "Nature Energy",
    "Chem. Mater.",
  ],
  careerStage: "PhD Year 3",
  industryVsAcademia: "both",
  locationPreferences: [],
  preferredMethods: [],
  phdYear: 3,
  digestEnabled: true,
  digestHourLocal: 8,
  digestTimezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC",
  digestChannel: "inapp",
  digestFrequency: "daily",
};

export const careerStages: CareerStage[] = [
  "PhD Year 1",
  "PhD Year 2",
  "PhD Year 3",
  "PhD Year 4",
  "PhD Year 5",
  "PhD Year 6",
  "Postdoc",
  "Research Scientist",
];

export const industryPreferences: IndustryAcademiaPreference[] = [
  "academia",
  "industry",
  "both",
  "startups",
  "bigTech",
];

export const venueOptions = [
  "No preference",
  "NeurIPS",
  "ICLR",
  "ICML",
  "CVPR",
  "ACL",
  "EMNLP",
  "NAACL",
  "CHI",
  "KDD",
  "AAAI",
  "arXiv",
];
