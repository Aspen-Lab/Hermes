import { describe, expect, it, vi } from "vitest";
import { defaultProfile } from "@/types";
import {
  buildEnrichmentContext,
  buildEventEnrichmentPrompt,
  buildJobEnrichmentPrompt,
  ENRICHMENT_FAILURE_TTL_MS,
  ENRICHMENT_SUCCESS_TTL_MS,
  hasEventEnrichment,
  hasEventEnrichmentCandidates,
  loadOpportunityEnrichment,
  opportunityEnrichmentCacheKey,
  parseEventEnrichment,
  parseJobEnrichment,
  readCachedOpportunityEnrichment,
  writeCachedOpportunityEnrichment,
  type JobEnrichment,
} from "./enrichment";
import type { Event, Job } from "@/types";

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

  it("shares one loader call across concurrent opens and then serves the cache", async () => {
    const storage = new MemoryStorage();
    const loader = vi.fn().mockResolvedValue(enrichment);

    const [first, second] = await Promise.all([
      loadOpportunityEnrichment("job:single-flight", loader, now, storage),
      loadOpportunityEnrichment("job:single-flight", loader, now, storage),
    ]);
    const third = await loadOpportunityEnrichment(
      "job:single-flight",
      loader,
      now + 1,
      storage,
    );

    expect(first).toEqual(enrichment);
    expect(second).toEqual(enrichment);
    expect(third).toEqual(enrichment);
    expect(loader).toHaveBeenCalledTimes(1);
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

describe("event enrichment prompt and parser", () => {
  const event: Event = {
    id: "event:parser",
    name: "Solid-State Battery Summit",
    type: "conference",
    date: "2026-09-10",
    endDate: "2026-09-11",
    location: "Chicago, IL",
    isOnline: false,
    deadline: "2026-08-01",
    shortDescription: "Research sessions and a poster call.",
    relevanceReason: "Matches the declared topic.",
    activities: ["Interface stability session", "Poster session"],
    organisations: [
      { name: "Known Lab", relevance: "You saved a role there." },
      { name: "New Company", descriptor: "Exhibitor" },
    ],
    people: [{ name: "New Speaker", role: "Professor", institution: "Peer U" }],
  };
  const rejectedJudgments = [
    {
      name: "Download Brochure",
      worthIt: false,
      why: "This appears to be a document or action, not an attendee.",
    },
    {
      name: "Companies A-K",
      worthIt: false,
      why: "This appears to be a category or group, not an individual attendee.",
    },
    {
      name: "Executive Team",
      worthIt: false,
      why: "This appears to be a group within an organization, not an individual attendee.",
    },
    {
      name: "Mailing List",
      worthIt: false,
      why: "This appears to be a communication channel, not an attendee.",
    },
    {
      name: "Request Information",
      worthIt: false,
      why: "This appears to be an action, not an attendee.",
    },
    {
      name: "Privacy Policy",
      worthIt: false,
      why: "This appears to be a document or legal statement, not an attendee.",
    },
  ];
  const rejectionEvent: Event = {
    ...event,
    organisations: [
      ...rejectedJudgments.map(({ name }) => ({ name })),
      { name: "Battery Power Online" },
      { name: "Lithium Battery Power" },
      { name: "Battery Safety" },
    ],
    people: [],
  };

  it("sends only roster rows that do not already have a Tier 0 judgment", () => {
    const prompt = JSON.parse(
      buildEventEnrichmentPrompt(event, "Topics: solid-state batteries"),
    ) as { event: { unjudgedAttendees: Array<{ name: string }> } };

    expect(prompt.event.unjudgedAttendees.map((item) => item.name)).toEqual([
      "New Company",
      "New Speaker",
    ]);
    expect(JSON.stringify(prompt)).not.toContain("You saved a role there.");
  });

  it("skips the provider and section when activities are only session types", async () => {
    const sessionTypesOnly: Event = {
      ...event,
      shortDescription: "A professional gathering.",
      activities: ["tutorial", "panel", "keynote"],
      organisations: [],
      people: [],
    };
    const provider = vi.fn();

    if (hasEventEnrichmentCandidates(sessionTypesOnly, "Topics: batteries")) {
      await provider();
    }
    const parsed = parseEventEnrichment(
      JSON.stringify({
        talkSummaries: [
          { title: "tutorial", about: "A guided learning experience." },
          { title: "panel", about: "A group discussion." },
          { title: "keynote", about: "A featured presentation." },
        ],
      }),
      sessionTypesOnly,
    );

    expect(provider).not.toHaveBeenCalled();
    expect(parsed).toEqual({});
    expect(hasEventEnrichment(parsed)).toBe(false);
  });

  it("sends only plausible titles from a mixed activity list", () => {
    const mixed: Event = {
      ...event,
      activities: [
        "tutorial",
        "Panel",
        "Interface stability session",
        "Fast-charging anode design",
        "poster session",
      ],
    };
    const prompt = JSON.parse(
      buildEventEnrichmentPrompt(mixed, "Topics: batteries"),
    ) as { event: { activities: string[] } };

    expect(prompt.event.activities).toEqual([
      "Interface stability session",
      "Fast-charging anode design",
    ]);
  });

  it("drops a hallucinated attendee and never overwrites a Tier 0 judgment", () => {
    const parsed = parseEventEnrichment(
      JSON.stringify({
        judgedAttendees: [
          { name: "Imaginary Person", worthIt: true, why: "Invented." },
          { name: "Known Lab", worthIt: false, why: "Would overwrite Tier 0." },
          { name: "New Company", worthIt: true, why: "Relevant interface work." },
        ],
      }),
      event,
    );

    expect(parsed).toEqual({
      judgedAttendees: [
        { name: "New Company", worthIt: true, why: "Relevant interface work." },
      ],
    });
  });

  it("drops all six measured attendee-rejection judgments", () => {
    const parsed = parseEventEnrichment(
      JSON.stringify({ judgedAttendees: rejectedJudgments }),
      rejectionEvent,
    );

    expect(parsed).toEqual({});
    expect(hasEventEnrichment(parsed)).toBe(false);
  });

  it("keeps only the three real rows from mixed measured output", () => {
    const realJudgments = [
      {
        name: "Battery Power Online",
        worthIt: true,
        why: "Covers battery-industry reporting.",
      },
      {
        name: "Lithium Battery Power",
        worthIt: true,
        why: "Tracks lithium battery developments.",
      },
      {
        name: "Battery Safety",
        worthIt: true,
        why: "Directly overlaps safety research.",
      },
    ];
    const parsed = parseEventEnrichment(
      JSON.stringify({
        judgedAttendees: [...rejectedJudgments, ...realJudgments],
      }),
      rejectionEvent,
    );

    expect(parsed?.judgedAttendees).toEqual(realJudgments);
  });

  it("keeps valid talk, plan, and poster judgments and drops unknown talks", () => {
    const parsed = parseEventEnrichment(
      JSON.stringify({
        talkSummaries: [
          { title: "Interface stability session", about: "A session on interfaces." },
          { title: "Invented keynote", about: "Not on the programme." },
        ],
        dayPlan: [{ day: "Day 1", items: ["Interface stability session"] }],
        posterFit: { fits: true, reasoning: "The call overlaps with interface work." },
      }),
      event,
    );

    expect(parsed).toEqual({
      talkSummaries: [
        { title: "Interface stability session", about: "A session on interfaces." },
      ],
      dayPlan: [{ day: "Day 1", items: ["Interface stability session"] }],
      posterFit: { fits: true, reasoning: "The call overlaps with interface work." },
    });
  });
});
