// ── Paper ──

export type PaperSource = "arxiv" | "neurIPS" | "iclr" | "icml" | "chi" | "other";

export type ItemFeedback = "liked" | "saved" | "notInterested" | "moreLikeThis";

export type PreferenceConceptSource =
  | "openalex_topic"
  | "openalex_keyword"
  | "openalex_concept"
  | "paper_keyword"
  | "job_tag"
  | "event_topic"
  | "legacy_disliked_topic";

export interface PreferenceConcept {
  key: string;
  label: string;
  source: PreferenceConceptSource;
  confidence?: number;
}

/** Which feed surface a piece of feedback came from. */
export type FeedItemKind = "paper" | "event" | "job";

export interface PreferenceLedgerEntry extends PreferenceConcept {
  positive: number;
  negative: number;
  lastPositiveAt?: string;
  lastNegativeAt?: string;
  lastSeenAt: string;
  /**
   * The surface the feedback was recorded from. Ledger influence is
   * directional: paper feedback informs events (strongly) and jobs
   * (moderately), event feedback informs jobs (weakly), and job/event
   * feedback never flows back into paper scoring. Entries without an
   * origin are legacy paper entries.
   */
  origin?: FeedItemKind;
}

export type PreferenceLedger = Record<string, PreferenceLedgerEntry>;

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
  preferenceSignals?: PreferenceConcept[];
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
  isSaved?: boolean;
  feedback?: ItemFeedback;
  preferenceSignals?: PreferenceConcept[];
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
  isSaved?: boolean;
  feedback?: ItemFeedback;
  preferenceSignals?: PreferenceConcept[];
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
export type UserAiProvider = "default" | "openai" | "gemini" | "anthropic" | "qwen" | "deepseek";
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
   * scoring pipeline as a legacy negative signal so matching papers rank lower.
   * New feedback uses `preferenceLedger`, which tracks positive and negative
   * evidence per concept instead of treating every disliked keyword as a hard
   * blacklist.
   */
  dislikedTopics?: string[];
  /**
   * Time-decayed, concept-keyed feedback ledger. Like and Save add equal
   * positive evidence; Not interested adds negative evidence after its undo
   * window commits.
   */
  preferenceLedger?: PreferenceLedger;
  /**
   * "Nice to have" topics — papers that match these get a score boost but
   * are not excluded when they don't match. Contrast with researchTopics
   * which act as a hard required-relevance filter.
   */
  softTopics?: string[];
  /**
   * Journals the user prefers (e.g. "Advanced Materials", "Nature Materials",
   * "Science", "JACS"). These are used as a primary paper source AND given a
   * scoring boost: a paper published in one of these journals has its relevance
   * score multiplied by 4/3 (+1/3 of its own score). A non-preferred paper that
   * is a much stronger match can still outrank a preferred-journal paper.
   */
  preferredJournals?: string[];
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
  /**
   * The user's advisor / principal investigator (a person's name). Anchors the
   * affiliation feature. Persisted in the legacy `lab` DB column (no migration).
   */
  advisorName?: string;
  /**
   * Resolved + user-confirmed OpenAlex author ID for the advisor (e.g.
   * "A5012345678"). Confirmed once, then permanent. Local-only. When set, the
   * feed seeds discovery from this author's work.
   */
  advisorAuthorId?: string;
  /** Confirmed human-readable identity, e.g. "Paul V. Braun · Materials Science, University of Illinois". Local-only. */
  advisorAuthorLabel?: string;
  /**
   * Cached discovery seeds derived from the advisor's recent, project-relevant
   * work. `advisorSeedTexts` (title + short abstract) bias TF-IDF scoring;
   * `advisorSeedWorkIds` (OpenAlex IDs) anchor the citation-neighborhood pull.
   * Recomputed monthly (see `advisorSeedsRefreshedAt`). Local-only.
   */
  advisorSeedWorkIds?: string[];
  advisorSeedTexts?: string[];
  /** ISO timestamp of the last monthly seed recompute. Local-only. */
  advisorSeedsRefreshedAt?: string | null;
  // Daily-digest preferences. `digestHourLocal` is interpreted in
  // `digestTimezone` (IANA name) by the scheduling cron.
  digestEnabled: boolean;
  digestHourLocal: number;
  digestTimezone: string;
  digestChannel: DigestChannel;
  digestFrequency: DigestFrequency;
  /**
   * Address the daily email digest is sent to. When blank, the cron falls back
   * to the user's account (OAuth) email. Synced to the `digest_email` DB column
   * so the server-side cron can read it.
   */
  digestEmail?: string;
  /**
   * Optional per-user data-source API keys for the jobs & events feeds. All
   * kept in local browser state (never synced to the shared profile row) so
   * users can bring their own keys without writing secrets server-side. Each
   * unlocks broader coverage:
   *   • Tavily   — web discovery of conferences + academic job boards (all fields)
   *   • Adzuna   — industry job aggregator across 19 countries (app_id + app_key)
   *   • USAJobs  — US federal / national-lab research posts (key + contact email)
   */
  tavilyEnabled: boolean;
  tavilyApiKey?: string;
  adzunaAppId?: string;
  adzunaAppKey?: string;
  usajobsApiKey?: string;
  usajobsUserAgent?: string;
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
  /**
   * ISO timestamp of when the user completed (or skipped) the first-run
   * onboarding wizard. `null` means they have never been through it, which is
   * what gates the welcome flow. Local-only for now (persisted to localStorage
   * via the zustand store, NOT synced to the Supabase profile row), so a fresh
   * browser re-shows onboarding — and clearing localStorage fully resets it,
   * which keeps local dev testing simple. See `web/supabase/` for the optional
   * migration to make this cross-device later.
   */
  onboardedAt?: string | null;
}

export const defaultProfile: UserProfile = {
  displayName: "Peer Member",
  // Empty by design — first-run users see the profile-setup nudge in the
  // header rather than a feed pre-tuned for someone else's PhD.
  researchTopics: [],
  careerStage: "PhD Year 3",
  industryVsAcademia: "both",
  locationPreferences: [],
  preferredMethods: [],
  phdYear: 3,
  dislikedTopics: [],
  preferenceLedger: {},
  softTopics: [],
  preferredJournals: [],
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
  digestEmail: "",
  tavilyEnabled: false,
  tavilyApiKey: "",
  adzunaAppId: "",
  adzunaAppKey: "",
  usajobsApiKey: "",
  usajobsUserAgent: "",
  feedAiProvider: "default",
  feedAiApiKey: "",
  deepReportEnabled: false,
  colorTheme: "system",
  onboardedAt: null,
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

