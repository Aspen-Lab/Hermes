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
  /** DOI (without the https://doi.org/ prefix). Used for Semantic Scholar lookups. */
  doi?: string;
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
export type FeedFocus = "tight" | "balanced" | "exploratory";
export type FeedFreshness = "today" | "week" | "month";
export type FeedSourceMix = "balanced" | "preprints" | "published" | "code" | "web";
export type FeedImportance = "new" | "highlyCited" | "rising";
export type FeedMethodMode = "mustMatch" | "relatedOk" | "any";
export type FeedDiscoveryMode = "core" | "adjacent" | "surprise";
export type UserAiProvider = "default" | "openai" | "gemini" | "anthropic" | "qwen";
export type ColorTheme =
  | "system"
  | "cream"
  | "white"
  | "pink"
  | "blue"
  | "sage"
  | "lavender"
  | "black"
  | "slate"
  | "plum";

export type ColorThemeMode = "auto" | "light" | "dark";

export interface UserProfile {
  displayName: string;
  researchTopics: string[];
  preferredVenues: string[];
  careerStage: CareerStage;
  industryVsAcademia: IndustryAcademiaPreference;
  locationPreferences: string[];
  preferredMethods: string[];
  phdYear?: number;
  /** Affiliation — university or company. */
  school?: string;
  /**
   * Free-text description of the specific project the user is currently
   * working on. Fed verbatim into the scoring profile (TF-IDF) and into
   * source queries as additional signal, so the briefing biases toward
   * what the user is actively building, not just their generic field.
   */
  currentProject?: string;
  /**
   * The specific open problems / unknowns the user is hunting information
   * about. Highest-leverage signal — papers that mention these challenges
   * should rise to the top of the briefing.
   */
  currentChallenges?: string;
  /**
   * Keywords from papers the user has explicitly disliked. Fed into the
   * scoring pipeline as negative signal so matching papers rank lower.
   */
  dislikedTopics?: string[];
  /**
   * "Nice to have" topics — papers that match these get a score boost but
   * are not excluded when they don't match. Contrast with researchTopics
   * which act as a hard required-relevance filter.
   */
  softTopics?: string[];
  feedFocus: FeedFocus;
  feedFreshness: FeedFreshness;
  paperCount: 5 | 10;
  feedSourceMix: FeedSourceMix;
  feedImportance: FeedImportance;
  feedMethodMode: FeedMethodMode;
  feedDiscoveryMode: FeedDiscoveryMode;
  feedAvoidReviews: boolean;
  feedAvoidOldPapers: boolean;
  feedAvoidBroadSurveys: boolean;
  /** Lab / group / team within `school`. */
  lab?: string;
  // Daily-digest preferences. `digestHourLocal` is interpreted in
  // `digestTimezone` (IANA name) by the scheduling cron.
  digestEnabled: boolean;
  digestHourLocal: number;
  digestTimezone: string;
  digestChannel: DigestChannel;
  digestFrequency: DigestFrequency;
  /**
   * Optional per-user Tavily web-search hook. Kept in local browser state so
   * users can bring their own key without writing it into the shared profile
   * row by default.
   */
  tavilyEnabled: boolean;
  tavilyApiKey?: string;
  /**
   * Optional per-user AI override for Tier 2 reranking. Also local-only so
   * users can bring their own normal API key without syncing secrets to the
   * shared profile row.
   */
  feedAiProvider: UserAiProvider;
  feedAiApiKey?: string;
  /**
   * Per-user toggle for deep paper reports. When ON, opening a paper triggers
   * full HTML/PDF fetch + two-pass LLM analysis (classify -> extract) using
   * `feedAiProvider`/`feedAiApiKey`. When OFF, the legacy abstract-only report
   * path is used. Burns more tokens per paper but produces specific,
   * paper-grounded reports instead of summarizing the abstract.
   */
  deepReportEnabled: boolean;
  colorTheme: ColorTheme;
}

export const defaultProfile: UserProfile = {
  displayName: "Hermes Member",
  // Empty by design — first-run users see the profile-setup nudge in the
  // header rather than a feed pre-tuned for someone else's PhD.
  researchTopics: [],
  preferredVenues: [],
  careerStage: "PhD Year 3",
  industryVsAcademia: "both",
  locationPreferences: [],
  preferredMethods: [],
  phdYear: 3,
  dislikedTopics: [],
  softTopics: [],
  feedFocus: "balanced",
  feedFreshness: "week",
  paperCount: 10,
  feedSourceMix: "balanced",
  feedImportance: "new",
  feedMethodMode: "relatedOk",
  feedDiscoveryMode: "core",
  feedAvoidReviews: true,
  feedAvoidOldPapers: false,
  feedAvoidBroadSurveys: true,
  digestEnabled: true,
  digestHourLocal: 8,
  digestTimezone:
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
      : "UTC",
  digestChannel: "inapp",
  digestFrequency: "daily",
  tavilyEnabled: false,
  tavilyApiKey: "",
  feedAiProvider: "default",
  feedAiApiKey: "",
  deepReportEnabled: false,
  colorTheme: "system",
};

export const colorThemeOptions: {
  value: ColorTheme;
  label: string;
  mode: ColorThemeMode;
}[] = [
  { value: "system", label: "System", mode: "auto" },
  { value: "cream", label: "Cream", mode: "light" },
  { value: "white", label: "White", mode: "light" },
  { value: "pink", label: "Pink", mode: "light" },
  { value: "blue", label: "Blue", mode: "light" },
  { value: "sage", label: "Sage", mode: "light" },
  { value: "lavender", label: "Lavender", mode: "light" },
  { value: "black", label: "Black", mode: "dark" },
  { value: "slate", label: "Slate", mode: "dark" },
  { value: "plum", label: "Plum", mode: "dark" },
];

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
