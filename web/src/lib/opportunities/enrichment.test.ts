import { describe, expect, it, vi } from "vitest";
import { defaultProfile } from "@/types";
import {
  buildEnrichmentContext,
  buildEventEnrichmentPrompt,
  buildJobEnrichmentPrompt,
  capGeneratedReasoning,
  ENRICHMENT_FAILURE_TTL_MS,
  ENRICHMENT_SUCCESS_TTL_MS,
  hasEventEnrichment,
  hasEventEnrichmentCandidates,
  hasJobEnrichment,
  loadOpportunityEnrichment,
  opportunityPageReadingReason,
  opportunityEnrichmentCacheKey,
  parseEventEnrichment,
  parseJobEnrichment,
  readCachedOpportunityEnrichment,
  resolveEventReportDescription,
  writeCachedOpportunityEnrichment,
  type JobEnrichment,
  type OpportunityEnrichmentLoadResult,
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


function eventWithUnjudged(names: string[]): Event {
  return {
    id: "eventweb:probe",
    source: "eventweb",
    name: "Probe Conference",
    type: "conference",
    date: "2026-09-09",
    location: "Chicago, IL",
    isOnline: false,
    shortDescription: "A conference.",
    relevanceReason: "Matches the declared topic.",
    organisations: names.map((name) => ({ name, descriptor: "Exhibitor" })),
  } as Event;
}

describe("rejection and generic-label filters resist rephrasing", () => {
  // These filters were first written against the six rejection strings and the
  // three session words that appeared in one real report. Equally common
  // phrasings from the same model leaked straight through to the user.
  const REJECTIONS = [
    "This appears to be a document or action, not an attendee.",
    "This appears to be a category or group, not an individual attendee.",
    "This appears to be a navigation link rather than an attendee.",
    "This is a website section, not a participant.",
    "This looks like a page element rather than a person attending.",
    "This seems to be a call-to-action button, not a real organisation.",
    "This is a legal document and does not represent an exhibitor.",
  ];

  it("drops every rephrased refusal, not only the ones first observed", () => {
    const event = eventWithUnjudged(["Download Brochure"]);
    for (const why of REJECTIONS) {
      const parsed = parseEventEnrichment(
        JSON.stringify({
          judgedAttendees: [
            { name: "Download Brochure", worthIt: false, why },
          ],
        }),
        event,
      );
      expect(parsed?.judgedAttendees ?? []).toEqual([]);
    }
  });

  it("drops a row the model explicitly flags, whatever the prose says", () => {
    const event = eventWithUnjudged(["Privacy Policy"]);
    const parsed = parseEventEnrichment(
      JSON.stringify({
        judgedAttendees: [
          {
            name: "Privacy Policy",
            isAttendee: false,
            worthIt: true,
            why: "A genuinely useful sounding sentence with no refusal wording.",
          },
        ],
      }),
      event,
    );
    expect(parsed?.judgedAttendees ?? []).toEqual([]);
  });

  it("keeps a real judgement", () => {
    const event = eventWithUnjudged(["Battery Power Online"]);
    const parsed = parseEventEnrichment(
      JSON.stringify({
        judgedAttendees: [
          {
            name: "Battery Power Online",
            isAttendee: true,
            worthIt: true,
            why: "A battery publication whose coverage overlaps your LCO work.",
          },
        ],
      }),
      event,
    );
    expect(parsed?.judgedAttendees).toHaveLength(1);
  });
});

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

  it("uses the short failure TTL when a source read fails with legacy enrichment", () => {
    const storage = new MemoryStorage();
    const failedResult: OpportunityEnrichmentLoadResult<JobEnrichment> = {
      enrichment,
      sourceReadStatus: "failed",
    };
    writeCachedOpportunityEnrichment(
      "job:source-failed",
      failedResult,
      now,
      storage,
    );

    expect(
      readCachedOpportunityEnrichment<
        OpportunityEnrichmentLoadResult<JobEnrichment>
      >(
        "job:source-failed",
        now + ENRICHMENT_FAILURE_TTL_MS - 1,
        storage,
      ),
    ).toEqual({ hit: true, enrichment: failedResult });
    expect(
      readCachedOpportunityEnrichment<
        OpportunityEnrichmentLoadResult<JobEnrichment>
      >(
        "job:source-failed",
        now + ENRICHMENT_FAILURE_TTL_MS,
        storage,
      ),
    ).toEqual({ hit: false, enrichment: null });
  });

  it("keeps a successful empty read outcome for the full success TTL", () => {
    const storage = new MemoryStorage();
    const readResult: OpportunityEnrichmentLoadResult<JobEnrichment> = {
      enrichment: {},
      sourceReadStatus: "read",
    };
    writeCachedOpportunityEnrichment(
      "job:source-read",
      readResult,
      now,
      storage,
    );

    expect(
      readCachedOpportunityEnrichment<
        OpportunityEnrichmentLoadResult<JobEnrichment>
      >(
        "job:source-read",
        now + ENRICHMENT_SUCCESS_TTL_MS - 1,
        storage,
      ),
    ).toEqual({ hit: true, enrichment: readResult });
  });

  it("derives one honest page-reading reason from the cached outcome", () => {
    expect(opportunityPageReadingReason(null, false)).toBe("no-provider");
    expect(opportunityPageReadingReason(null, true)).toBe("read-failed");
    expect(
      opportunityPageReadingReason(
        { enrichment: {}, sourceReadStatus: "read" },
        true,
      ),
    ).toBe("no-quotable-details");
    expect(
      opportunityPageReadingReason(
        { enrichment: null, sourceReadStatus: "read" },
        true,
      ),
    ).toBe("read-failed");
    expect(
      opportunityPageReadingReason(
        { enrichment, sourceReadStatus: "failed" },
        true,
      ),
    ).toBe("read-failed");
    expect(
      opportunityPageReadingReason(
        { enrichment: null, sourceReadStatus: "not-requested" },
        true,
      ),
    ).toBe("no-provider");
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

  it("labels fetched job text as the only source for exact specifics", () => {
    const sourceText =
      "A PhD in electrochemistry is required.\n\nDesign and run interface experiments.";
    const prompt = JSON.parse(
      buildJobEnrichmentPrompt(
        job,
        "Topics: solid-state batteries",
        sourceText,
      ),
    ) as {
      fetchedPageText?: string;
      rules: Record<string, string>;
    };

    expect(prompt.fetchedPageText).toBe(sourceText);
    expect(prompt.rules.specificRequirements).toContain("exactly");
    expect(prompt.rules.specificRequirements).toContain("at most 6");
    expect(prompt.rules.specificRequirements).toContain("bounded job fields");
    expect(prompt.rules.specificDuties).toContain("exactly");
    expect(prompt.rules.specificDuties).toContain("at most 6");
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

  it("keeps quotable job specifics and drops invented or duplicate ones", () => {
    const parsed = parseJobEnrichment(
      JSON.stringify({
        specificRequirements: [
          "A PhD in electrochemistry is required.",
          "a phd   in electrochemistry is required.",
          "Five years of battery-industry experience is required.",
        ],
        specificDuties: [
          "Design and run interface experiments.",
          "design and run interface experiments.",
          "Manage a team of twenty researchers.",
        ],
      }),
      job,
      "Requirements: A PHD   IN ELECTROCHEMISTRY IS REQUIRED.\n\nDuties: Design and run interface experiments.",
    );

    expect(parsed).toEqual({
      specificRequirements: ["A PhD in electrochemistry is required."],
      specificDuties: ["Design and run interface experiments."],
    });
    expect(hasJobEnrichment(parsed)).toBe(true);
  });

  it("caps each quotable job-specific section at six items", () => {
    const requirements = Array.from(
      { length: 8 },
      (_, index) => `Requirement ${index + 1} is required.`,
    );
    const duties = Array.from(
      { length: 8 },
      (_, index) => `Duty ${index + 1} must be completed.`,
    );
    const parsed = parseJobEnrichment(
      JSON.stringify({
        specificRequirements: requirements,
        specificDuties: duties,
      }),
      job,
      [...requirements, ...duties].join("\n\n"),
    );

    expect(parsed?.specificRequirements).toEqual(requirements.slice(0, 6));
    expect(parsed?.specificDuties).toEqual(duties.slice(0, 6));
  });

  it("omits both specifics when a fetched page quotes neither one", () => {
    expect(
      parseJobEnrichment(
        JSON.stringify({
          specificRequirements: ["Invented requirement"],
          specificDuties: ["Invented duty"],
        }),
        job,
        "This posting contains unrelated source text.",
      ),
    ).toEqual({});
  });

  it("never falls back to bounded job fields when no page text was fetched", () => {
    expect(
      parseJobEnrichment(
        JSON.stringify({
          specificRequirements: ["PhD", "Invented requirement"],
          specificDuties: ["Invented duty"],
        }),
        job,
      ),
    ).toEqual({});
  });

  it.each([
    { specificRequirements: ["Quoted requirement"] },
    { specificDuties: ["Quoted duty"] },
  ])("counts each quoted-specific section as job enrichment", (enrichment) => {
    expect(hasJobEnrichment(enrichment)).toBe(true);
  });

  it("keeps the two quoted specifics alongside all four existing sections", () => {
    const raw = {
      competitiveness: { verdict: "Strong", reasoning: "Methods align." },
      sponsorshipRead: { likelihood: "Plausible", basis: "Inferred from role history." },
      roleSummary: ["One.", "Two.", "Three."],
      emphasise: ["Battery methods", "Interface work"],
      specificRequirements: ["A PhD in electrochemistry is required."],
      specificDuties: ["Design and run interface experiments."],
    };

    expect(
      parseJobEnrichment(
        JSON.stringify(raw),
        job,
        "A PhD in electrochemistry is required.\n\nDesign and run interface experiments.",
      ),
    ).toEqual(raw);
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

  it("caps a generated event description at two sentences", () => {
    expect(
      parseEventEnrichment(
        JSON.stringify({
          condensedDescription:
            "Researchers present interface studies. The programme includes applied workshops. A third sentence must not render.",
        }),
        event,
      ),
    ).toEqual({
      condensedDescription:
        "Researchers present interface studies. The programme includes applied workshops.",
    });
  });

  it("leaves a complete extractive description untouched when no condensed field exists", () => {
    const extractive = "Research sessions cover interfaces and cell design.";

    expect(resolveEventReportDescription(extractive, {})).toBe(extractive);
  });

  it("trims a Tier 0 description back to its last complete sentence", () => {
    expect(
      resolveEventReportDescription(
        "Research sessions cover interfaces. The programme also includes an unfinished",
      ),
    ).toBe("Research sessions cover interfaces.");
  });

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

  it("uses the description as an enrichment candidate without reviving generic session types", async () => {
    const sessionTypesOnly: Event = {
      ...event,
      shortDescription: "A professional gathering.",
      activities: ["tutorial", "panel", "keynote"],
      organisations: [],
      people: [],
    };
    const provider = vi.fn();

    const hasCandidates = hasEventEnrichmentCandidates(
      sessionTypesOnly,
      "Topics: batteries",
    );
    if (hasCandidates) {
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

    expect(hasCandidates).toBe(true);
    expect(provider).toHaveBeenCalledOnce();
    expect(parsed).toEqual({});
    expect(hasEventEnrichment(parsed)).toBe(false);
  });

  it("keeps Tier 0 labels separate from fetched talk-title evidence", () => {
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
      buildEventEnrichmentPrompt(
        mixed,
        "Topics: batteries",
        "[PROGRAMME HEADING LEVEL 3] Interface Stability in Solid-State Cells",
        [{ level: 3, text: "Interface Stability in Solid-State Cells" }],
      ),
    ) as {
      task: string;
      fetchedPageText: string;
      event: { sessionTypes: string[]; activities?: string[] };
      rules: {
        judgedAttendees: string;
        talkSummaries: string;
        dayPlan: string;
      };
    };

    expect(prompt.fetchedPageText).toBe(
      "[PROGRAMME HEADING LEVEL 3] Interface Stability in Solid-State Cells",
    );
    expect(prompt.event.sessionTypes).toEqual(mixed.activities);
    expect(prompt.event.activities).toBeUndefined();
    expect(prompt.rules.talkSummaries).toContain("fetchedPageText");
    expect(prompt.rules.talkSummaries).toContain("PROGRAMME HEADING LEVEL");
    expect(prompt.rules.talkSummaries).toContain("exactly");
    expect(prompt.rules.talkSummaries).toContain("at most 6");
    expect(prompt.rules.talkSummaries).toContain("at most 30 words");
    expect(prompt.rules.talkSummaries).toContain("never an abstract");
    expect(prompt.rules.judgedAttendees).toContain("at most 8");
    expect(prompt.rules.dayPlan).toContain("at most 3 event days");
    expect(prompt.rules.dayPlan).toContain("at most 4 items per day");
    expect(prompt.rules.dayPlan).toContain("also returned in talkSummaries");
    expect(prompt.task).toContain("entire JSON closes");
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

  it("keeps a quotable talk title and drops one absent from the fetched text", () => {
    const parsed = parseEventEnrichment(
      JSON.stringify({
        talkSummaries: [
          {
            title: "Interface Stability in Solid-State Cells",
            about: "A session on interfaces.",
          },
          {
            title: "interface   stability in solid-state cells",
            about: "A duplicate with different case and whitespace.",
          },
          { title: "Invented keynote", about: "Not on the programme." },
        ],
        dayPlan: [
          { day: "Day 1", items: ["Interface Stability in Solid-State Cells"] },
        ],
        posterFit: { fits: true, reasoning: "The call overlaps with interface work." },
      }),
      event,
      "09:00 INTERFACE   STABILITY IN SOLID-STATE CELLS\n\nInterface stability session\n\n10:00 Lunch",
      [{ level: 3, text: "Interface Stability in Solid-State Cells" }],
    );

    expect(parsed).toEqual({
      talkSummaries: [
        {
          title: "Interface Stability in Solid-State Cells",
          about: "A session on interfaces.",
        },
      ],
      dayPlan: [
        { day: "Day 1", items: ["Interface Stability in Solid-State Cells"] },
      ],
      posterFit: { fits: true, reasoning: "The call overlaps with interface work." },
    });
  });

  it("caps event arrays so the single response fits its token ceiling", () => {
    const titles = Array.from(
      { length: 9 },
      (_, index) => `Interface Study ${index + 1}`,
    );
    const organisations = Array.from(
      { length: 10 },
      (_, index) => ({ name: `Battery Lab ${index + 1}` }),
    );
    const cappedEvent: Event = { ...event, organisations, people: [] };
    const parsed = parseEventEnrichment(
      JSON.stringify({
        judgedAttendees: organisations.map(({ name }) => ({
          name,
          isAttendee: true,
          worthIt: true,
          why: "Relevant battery work.",
        })),
        talkSummaries: titles.map((title) => ({
          title,
          about: "A concise explanation.",
        })),
        dayPlan: Array.from({ length: 5 }, (_, index) => ({
          day: `Day ${index + 1}`,
          items: titles.slice(0, 6),
        })),
      }),
      cappedEvent,
      titles.join("\n\n"),
      titles.map((title) => ({ level: 3, text: title })),
    );

    expect(parsed?.judgedAttendees).toHaveLength(8);
    expect(parsed?.talkSummaries).toHaveLength(6);
    expect(parsed?.dayPlan).toHaveLength(3);
    expect(parsed?.dayPlan?.every((day) => day.items.length === 4)).toBe(true);
  });

  it("does not plan a seventh title that was omitted by the summary cap", () => {
    const titles = Array.from(
      { length: 7 },
      (_, index) => `Battery Interface Study ${index + 1}`,
    );
    const parsed = parseEventEnrichment(
      JSON.stringify({
        talkSummaries: titles.map((title) => ({
          title,
          about: "A concise explanation.",
        })),
        dayPlan: [{ day: "Day 1", items: [titles[6]] }],
      }),
      event,
      titles.join("\n\n"),
      titles.map((text) => ({ level: 3, text })),
    );

    expect(parsed?.talkSummaries).toHaveLength(6);
    expect(parsed?.dayPlan).toBeUndefined();
  });

  it("never falls back to activities when fetched page text is absent", () => {
    expect(
      parseEventEnrichment(
        JSON.stringify({
          talkSummaries: [
            {
              title: "Interface stability session",
              about: "A session on interfaces.",
            },
          ],
        }),
        event,
      ),
    ).toEqual({});
  });

  it("drops invented day-plan entries and keeps quoted titles or supplied names", () => {
    expect(
      parseEventEnrichment(
        JSON.stringify({
          judgedAttendees: [
            {
              name: "New Speaker",
              isAttendee: true,
              worthIt: true,
              why: "Relevant interface work.",
            },
          ],
          talkSummaries: [
            {
              title: "Interface Stability in Solid-State Cells",
              about: "A session on interfaces.",
            },
          ],
          dayPlan: [
            {
              day: "Day 1",
              items: [
                "Interface Stability in Solid-State Cells",
                "New Speaker",
                "Invented Closing Keynote",
              ],
            },
          ],
        }),
        event,
        "09:00 Interface Stability in Solid-State Cells",
        [{ level: 3, text: "Interface Stability in Solid-State Cells" }],
      ),
    ).toEqual({
      judgedAttendees: [
        {
          name: "New Speaker",
          worthIt: true,
          why: "Relevant interface work.",
        },
      ],
      talkSummaries: [
        {
          title: "Interface Stability in Solid-State Cells",
          about: "A session on interfaces.",
        },
      ],
      dayPlan: [
        {
          day: "Day 1",
          items: [
            "Interface Stability in Solid-State Cells",
            "New Speaker",
          ],
        },
      ],
    });
  });

  it("drops a verbatim abstract paragraph instead of presenting it as a talk title", () => {
    const realTitle = "Materials Informatics-Guided Design of Battery Materials";
    const abstract =
      "This presentation explains how interface measurements reveal degradation in solid-state battery cells.";

    expect(
      parseEventEnrichment(
        JSON.stringify({
          talkSummaries: [
            { title: abstract, about: "The model mistook prose for a heading." },
            { title: realTitle, about: "A focused materials-design talk." },
          ],
        }),
        event,
        `${realTitle}\n\n${abstract}`,
        [{ level: 3, text: realTitle }],
      ),
    ).toEqual({
      talkSummaries: [
        { title: realTitle, about: "A focused materials-design talk." },
      ],
    });
  });

  it("does not present a supplied speaker heading as a talk title", () => {
    expect(
      parseEventEnrichment(
        JSON.stringify({
          talkSummaries: [
            { title: "New Speaker", about: "A person, not a talk." },
          ],
        }),
        event,
        "New Speaker",
        [{ level: 4, text: "New Speaker" }],
      ),
    ).toEqual({});
  });

  it("rejects a different-level speaker heading when programme talks share a level", () => {
    const speaker =
      "Adrian Tylim, Head Business Development, Natrion, Head Business Development";
    expect(
      parseEventEnrichment(
        JSON.stringify({
          talkSummaries: [{ title: speaker, about: "A person, not a talk." }],
        }),
        { ...event, organisations: [], people: [] },
        `${speaker}\n\nMaterials Informatics-Guided Design\n\nInterface Stability in Solid-State Cells`,
        [
          { level: 4, text: speaker },
          { level: 3, text: "Materials Informatics-Guided Design" },
          { level: 3, text: "Interface Stability in Solid-State Cells" },
        ],
      ),
    ).toEqual({});
  });

  it("excludes known roster names before choosing the programme-title heading level", () => {
    const talks = [
      "Materials Informatics-Guided Design",
      "Interface Stability in Solid-State Cells",
    ];
    const speakers = ["Speaker Alpha", "Speaker Beta", "Speaker Gamma"];
    const speakerDominantEvent: Event = {
      ...event,
      organisations: [],
      people: speakers.map((name) => ({ name })),
    };
    const headings = [
      ...speakers.map((text) => ({ level: 4, text })),
      ...talks.map((text) => ({ level: 3, text })),
    ];
    const markedText = headings
      .map(({ level, text }) => `[PROGRAMME HEADING LEVEL ${level}] ${text}`)
      .join("\n\n");
    const prompt = JSON.parse(
      buildEventEnrichmentPrompt(
        speakerDominantEvent,
        "Topics: batteries",
        markedText,
        headings,
      ),
    ) as { fetchedPageText: string };

    expect(prompt.fetchedPageText).toContain(
      "[PROGRAMME HEADING LEVEL 3] Materials Informatics-Guided Design",
    );
    expect(prompt.fetchedPageText).not.toContain(
      "[PROGRAMME HEADING LEVEL 4] Speaker Alpha",
    );
    expect(prompt.fetchedPageText).toContain("Speaker Alpha");
    expect(
      parseEventEnrichment(
        JSON.stringify({
          talkSummaries: [
            { title: talks[0], about: "A materials-design talk." },
          ],
        }),
        speakerDominantEvent,
        markedText,
        headings,
      ),
    ).toEqual({
      talkSummaries: [
        { title: talks[0], about: "A materials-design talk." },
      ],
    });
  });

  it("drops a page speaker name from the plan unless it was supplied as an attendee", () => {
    expect(
      parseEventEnrichment(
        JSON.stringify({
          dayPlan: [{ day: "Day 1", items: ["Unlisted Page Speaker"] }],
        }),
        event,
        "Unlisted Page Speaker",
      ),
    ).toEqual({});
  });

  it("does not plan a supplied roster row the same response rejects as furniture", () => {
    const furnitureEvent: Event = {
      ...event,
      organisations: [{ name: "Download Brochure" }],
      people: [],
    };
    expect(
      parseEventEnrichment(
        JSON.stringify({
          judgedAttendees: [
            {
              name: "Download Brochure",
              isAttendee: false,
              worthIt: false,
              why: "This is an action, not an attendee.",
            },
          ],
          dayPlan: [{ day: "Day 1", items: ["Download Brochure"] }],
        }),
        furnitureEvent,
      ),
    ).toEqual({});
  });

  it("omits talk summaries when the response contains only generic labels", () => {
    const genericLabels = [
      "poster session",
      "workshop",
      "tutorial",
      "panel",
      "career fair",
      "job fair",
      "exhibition",
      "networking",
      "hackathon",
      "symposium",
      "keynote",
      "plenary",
      "awards ceremony",
      "competition",
      "short course",
      "demo session",
      "doctoral consortium",
      "banquet",
      "social event",
      "lightning talk",
      "field trip",
      "school",
      "town hall",
      "meet the expert",
      "hands-on session",
      "gala dinner",
      "technical tour",
      "summer school",
      "winter school",
      "methods school",
      "doctoral school",
    ];
    const talkSummaries = genericLabels.map((title) => ({
      title,
      about: "A generic programme category.",
    }));

    expect(
      parseEventEnrichment(
        JSON.stringify({ talkSummaries }),
        event,
        genericLabels.join("\n"),
        genericLabels.map((text) => ({ level: 3, text })),
      ),
    ).toEqual({});
  });

  it("omits live programme logistics headings from talk summaries", () => {
    const logistics = [
      "Registration Open and Morning Coffee",
      "Organizer's Opening Remarks",
      "Chairperson's Remarks",
      "Welcome Coffee Break in the Exhibit Hall with Poster Viewing",
      "Refreshment Break in the Exhibit Hall with Poster Viewing",
      "Welcome Reception in the Exhibit Hall with Poster Viewing",
      "Evening Tutorial*",
      "Enjoy Lunch on Your Own",
      "Close of Day",
    ];
    expect(
      parseEventEnrichment(
        JSON.stringify({
          talkSummaries: logistics.map((title) => ({
            title,
            about: "Schedule logistics, not a talk.",
          })),
        }),
        event,
        logistics.join("\n\n"),
        logistics.map((text) => ({ level: 3, text })),
      ),
    ).toEqual({});
  });

  it("caps a 180-word poster explanation without dropping its verdict", () => {
    const reasoning = Array.from(
      { length: 180 },
      (_, index) => `reason${index + 1}`,
    ).join(" ");
    const parsed = parseEventEnrichment(
      JSON.stringify({ posterFit: { fits: true, reasoning } }),
      event,
    );

    expect(parsed?.posterFit?.fits).toBe(true);
    expect(parsed?.posterFit?.reasoning).toBe(capGeneratedReasoning(reasoning));
    expect(parsed?.posterFit?.reasoning.split(/\s+/)).toHaveLength(60);
    expect(parsed?.posterFit?.reasoning).toMatch(/reason60\u2026$/);
    expect(parsed?.posterFit?.reasoning).not.toContain("reason61");
  });
});
