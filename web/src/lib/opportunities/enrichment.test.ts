import { describe, expect, it } from "vitest";
import { defaultProfile } from "@/types";
import {
  buildEnrichmentContext,
  buildJobEnrichmentPrompt,
  ENRICHMENT_FAILURE_TTL_MS,
  ENRICHMENT_SUCCESS_TTL_MS,
  opportunityEnrichmentCacheKey,
  parseJobEnrichment,
  readCachedOpportunityEnrichment,
  writeCachedOpportunityEnrichment,
  type JobEnrichment,
} from "./enrichment";
import type { Job } from "@/types";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("opportunity report enrichment cache", () => {
  const now = Date.UTC(2026, 6, 31, 12);
  const enrichment: JobEnrichment = {
    competitiveness: {
      verdict: "Strong match",
      reasoning: "Your declared methods cover the core requirements.",
    },
  };

  it("returns a fresh successful cache hit", () => {
    const storage = new MemoryStorage();
    writeCachedOpportunityEnrichment("job:key", enrichment, now, storage);

    expect(
      readCachedOpportunityEnrichment<JobEnrichment>(
        "job:key",
        now + ENRICHMENT_SUCCESS_TTL_MS - 1,
        storage,
      ),
    ).toEqual({ hit: true, enrichment });
  });

  it("returns a miss when no entry exists", () => {
    expect(
      readCachedOpportunityEnrichment<JobEnrichment>(
        "job:missing",
        now,
        new MemoryStorage(),
      ),
    ).toEqual({ hit: false, enrichment: null });
  });

  it("expires a successful entry after seven days", () => {
    const storage = new MemoryStorage();
    writeCachedOpportunityEnrichment("job:key", enrichment, now, storage);

    expect(
      readCachedOpportunityEnrichment<JobEnrichment>(
        "job:key",
        now + ENRICHMENT_SUCCESS_TTL_MS,
        storage,
      ),
    ).toEqual({ hit: false, enrichment: null });
  });

  it("caches a failed enrichment for six hours", () => {
    const storage = new MemoryStorage();
    writeCachedOpportunityEnrichment("job:key", null, now, storage);

    expect(
      readCachedOpportunityEnrichment<JobEnrichment>(
        "job:key",
        now + ENRICHMENT_FAILURE_TTL_MS - 1,
        storage,
      ),
    ).toEqual({ hit: true, enrichment: null });
    expect(
      readCachedOpportunityEnrichment<JobEnrichment>(
        "job:key",
        now + ENRICHMENT_FAILURE_TTL_MS,
        storage,
      ),
    ).toEqual({ hit: false, enrichment: null });
  });

  it("changes the key when the provider changes", () => {
    const defaultKey = opportunityEnrichmentCacheKey(
      "job",
      "job-1",
      "Topics: batteries",
      "default",
    );
    const geminiKey = opportunityEnrichmentCacheKey(
      "job",
      "job-1",
      "Topics: batteries",
      "gemini",
    );

    expect(defaultKey).not.toBe(geminiKey);
  });
});

describe("buildEnrichmentContext", () => {
  it("uses only declared profile context and never includes a key", () => {
    const profile = {
      ...defaultProfile,
      researchTopics: ["solid-state batteries"],
      preferredMethods: ["electrochemical impedance spectroscopy"],
      currentProject: "  Scale a pouch-cell prototype.  ",
      currentChallenges: "Interface resistance",
      authorisedCountries: ["United States"],
      feedAiApiKey: "must-not-appear",
    };
    const context = buildEnrichmentContext(profile);

    expect(context).toContain("Career stage: PhD Year 3");
    expect(context).toContain("Topics: solid-state batteries");
    expect(context).toContain("Methods: electrochemical impedance spectroscopy");
    expect(context).toContain("Current project: Scale a pouch-cell prototype.");
    expect(context).toContain("Current challenges: Interface resistance");
    expect(context).toContain("Can work without sponsorship in: United States");
    expect(context).not.toContain("must-not-appear");
  });
});

describe("job enrichment prompt and parser", () => {
  const job: Job = {
    id: "job:parser",
    roleTitle: "Battery Research Scientist",
    companyOrLab: "Volta Lab",
    location: "Chicago, IL",
    isRemote: false,
    keyRequirements: ["PhD", "Electrochemistry"],
    matchReason: "Matches the declared topic.",
    summary: "Lead interface-stability experiments.",
    matchedTerms: ["solid-state battery"],
    roleKind: "staff",
    employmentType: "full-time",
    salary: { min: 120_000, max: 150_000, currency: "USD", period: "year" },
    visa: { state: "not-stated", country: "United States" },
  };

  it("builds the prompt from the bounded posting fields and profile context", () => {
    const prompt = JSON.parse(
      buildJobEnrichmentPrompt(job, "Topics: solid-state batteries"),
    ) as Record<string, unknown>;

    expect(prompt.userContext).toBe("Topics: solid-state batteries");
    expect(prompt.job).toMatchObject({
      roleTitle: job.roleTitle,
      companyOrLab: job.companyOrLab,
      summary: job.summary,
      keyRequirements: job.keyRequirements,
      matchedTerms: job.matchedTerms,
      roleKind: job.roleKind,
      employmentType: job.employmentType,
      salary: job.salary,
      visaState: "not-stated",
    });
  });

  it("drops a sponsorship judgment when the posting already states its position", () => {
    const parsed = parseJobEnrichment(
      JSON.stringify({
        sponsorshipRead: {
          likelihood: "Likely",
          basis: "The employer has sponsored similar roles.",
        },
      }),
      { visa: { state: "sponsors", evidence: "We sponsor this position." } },
    );

    expect(parsed).toEqual({});
  });

  it("drops a four-entry role summary rather than truncating it", () => {
    const parsed = parseJobEnrichment(
      JSON.stringify({ roleSummary: ["One.", "Two.", "Three.", "Four."] }),
      job,
    );

    expect(parsed).toEqual({});
  });

  it("returns an empty enrichment when every field is missing", () => {
    expect(parseJobEnrichment("{}", job)).toEqual({});
  });

  it("keeps all four valid sections for a silent-visa posting", () => {
    const raw = {
      competitiveness: { verdict: "Strong", reasoning: "Methods align." },
      sponsorshipRead: { likelihood: "Plausible", basis: "Inferred from role history." },
      roleSummary: ["One.", "Two.", "Three."],
      emphasise: ["Battery methods", "Interface work"],
    };

    expect(parseJobEnrichment(JSON.stringify(raw), job)).toEqual(raw);
  });
});
