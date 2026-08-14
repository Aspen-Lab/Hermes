import { describe, expect, it } from "vitest";
import { isListingPage, webResultToRawJobItem } from "./jobweb";

describe("job aggregator listing pages", () => {
  it.each([
    "60 Molten Salt Jobs, Employment July 22, 2026 (9 New Openings)",
    "1,204 Battery Engineer Jobs, Employment",
    "25+ Postdoc Positions in Materials Science",
    "Browse Chemistry Jobs",
    "Latest Research Scientist Vacancies",
  ])("rejects aggregate listing title: %s", (title) => {
    expect(isListingPage(title, "indeed.com", "/jobs")).toBe(true);
  });

  it.each([
    "Molten Salt Electrochemistry Summer Internship",
    "Research Scientist, Solid-State Batteries",
    "Postdoctoral Researcher — Battery Materials",
  ])("keeps a real posting title: %s", (title) => {
    expect(isListingPage(title, "careers.inl.gov", "/job/12345")).toBe(false);
  });

  it("rejects an aggregator search URL even with a neutral title", () => {
    expect(
      isListingPage("Molten Salt", "indeed.com", "/jobs?q=molten+salt&l=Chicago"),
    ).toBe(true);
  });

  it("does not over-block an employer's own careers search landing page", () => {
    expect(
      isListingPage(
        "Research Engineer, Battery Systems",
        "careers.ford.com",
        "/search?q=battery",
      ),
    ).toBe(false);
  });

  it("filters the Indeed listing end to end", () => {
    expect(
      webResultToRawJobItem({
        title: "60 Molten Salt Jobs, Employment July 22, 2026 (9 New Openings)",
        url: "https://www.indeed.com/q-molten-salt-jobs.html",
        snippet: "Apply now to molten salt jobs. Research Scientist roles available.",
      }),
    ).toBeNull();
  });

  it("still accepts a genuine posting", () => {
    const item = webResultToRawJobItem({
      title: "Molten Salt Electrochemistry Summer Internship - INL Careers",
      url: "https://inl.jobs/careers/job/12345",
      snippet: "Internship in molten salt electrochemistry. Apply now.",
    });
    expect(item).not.toBeNull();
    expect(item!.title).toBe("Molten Salt Electrochemistry Summer Internship");
  });
});

describe("careers index and aggregator category pages", () => {
  it.each(["CAREERS", "Careers", "Jobs", "Open Positions", "Join our team", "Vacancies"])(
    "rejects careers index title: %s",
    (title) => {
      expect(isListingPage(title, "acunextlab.org", "/careers")).toBe(true);
    },
  );

  it("rejects an aggregator category page with no posting id", () => {
    expect(
      isListingPage(
        "Internship Battery Research Scientist Jobs San Jose, CA",
        "ziprecruiter.com",
        "/Jobs/Internship-Battery-Research-Scientist/-in-San-Jose,CA",
      ),
    ).toBe(true);
  });

  it("keeps an aggregator posting that carries an id", () => {
    expect(
      isListingPage("Battery Research Scientist", "ziprecruiter.com", "/c/Acme/Job/Battery-Scientist/-in-San-Jose?jid=1234567"),
    ).toBe(false);
  });

  it("keeps a specific posting on an employer careers path", () => {
    expect(
      isListingPage("Internship Battery R&D", "hyetlithium.com", "/careers/internship-battery-research"),
    ).toBe(false);
  });
});

describe("company derivation", () => {
  // B4-03 (round 4): no test asserted `.company` anywhere in this file
  // before this round (grepped, zero hits) — this is the first coverage of
  // webResultToRawJobItem's company-picking logic at all.
  it("does not mistake an internship cohort/season segment for the company", () => {
    const item = webResultToRawJobItem({
      title: "Battery R&D Intern - Summer 2027 - Acme Corp",
      url: "https://acme.test/careers/job/9912",
      snippet: "Research internship in molten salt battery R&D. Apply now.",
    });
    expect(item?.company).toBe("Acme Corp");
  });

  // B6-03 (round 6): a rejected candidate must not become an unguarded host
  // fallback; absence is an honest employer value.
  it("leaves the company absent when only a season segment survives", () => {
    const item = webResultToRawJobItem({
      title: "Battery R&D Intern - Summer 2027",
      url: "https://acme.test/careers/job/9912",
      snippet: "Research internship in molten salt battery R&D. Apply now.",
    });
    expect(item?.company).toBeUndefined();
  });

  // B12-06 (round 12): openmc.discourse.group rendered the employer as
  // "Page 2" — round 12 A's worst single value of the round. Not a missing
  // pagination rule: a missing FAMILY MEMBER. The event side has had chrome
  // checks whose job is "this segment is site furniture, not a name" since
  // round 5, and its own word list even contains "page"; the employer slot had
  // no member of that family at all. Its six existing rejections all ask "is
  // this a known-bad KIND of name", never "is this navigation".
  describe("navigation chrome in the employer slot (B12-06)", () => {
    // All three plausible Discourse title shapes for a paginated thread. B
    // reproduced the observed value byte-for-byte on every one of them, and
    // recorded the reconstruction as a reconstruction; asserting all three is
    // what makes the fix independent of which shape the provider actually
    // sends.
    // RESTATED BY B14-01 (round 14, Ruling 43), NOT DELETED. This block used to
    // carry the real openmc forum URL. B14-01 drops that URL at
    // `isListingPage`, so `webResultToRawJobItem` now returns `null` and
    // `item?.company` would be `undefined` FOR THE WRONG REASON — the assertion
    // would keep PASSING while B12-06's pagination guard stopped being
    // exercised at all. B named this exact class: a test that goes green while
    // the guard it exercises becomes unreachable. The URL is repointed at a
    // non-forum posting so the pagination guard is genuinely tested again; the
    // openmc URL's new drop is asserted separately below.
    it.each([
      "Job vacancies looking for OpenMC skills - Page 2 - Users - OpenMC Discourse",
      "Job vacancies looking for OpenMC skills - Page 2 - OpenMC Discourse",
      "Job vacancies looking for OpenMC skills | Page 2 | OpenMC",
    ])("does not mistake a pagination label for the employer: %s", (title) => {
      const item = webResultToRawJobItem({
        title,
        url: "https://example.test/careers/job/9912?page=2",
        snippet: "Several groups are hiring for molten salt reactor work. Apply now.",
      });
      expect(item).not.toBeNull();
      expect(item?.company).not.toBe("Page 2");
    });

    // B14-01: the counterpart assertion. The real openmc forum thread URL no
    // longer produces an item at all, so no employer can be derived from it —
    // which is how Ruling 43's wrong value is closed. Kept next to B12-06's
    // block so the two contracts are read together rather than one silently
    // masking the other.
    it("drops the real openmc forum thread outright (B14-01) — no item, so no employer", () => {
      const item = webResultToRawJobItem({
        title: "Job vacancies looking for OpenMC skills - Page 2 - Announcements - OpenMC",
        url: "https://openmc.discourse.group/t/job-vacancies-looking-for-openmc-skills/1727?page=2",
        snippet: "Several groups are hiring for molten salt reactor work. Apply now.",
      });
      expect(item).toBeNull();
    });

    // The rest of the closed vocabulary, asserted on the guard's own shape so
    // each alternative is covered rather than assumed.
    // RESTATED BY B14-01 (round 14), NOT DELETED. The URL here was
    // `https://example.test/forum/t/thread/1?page=2` — a forum-thread shape,
    // which B14-01 now drops. The assertion would have kept PASSING with
    // `item` null and `item?.company` undefined for the wrong reason, so the
    // whole closed nav-chrome vocabulary would have stopped being checked
    // without a single red test. Repointed at a non-forum posting URL, plus an
    // explicit `not.toBeNull()` so this can never silently go vacuous again.
    it.each(["Page 2", "Page 12 of 40", "3 of 10", "Next", "Home", "Previous", "Back"])(
      "rejects the nav-chrome segment %s",
      (segment) => {
        const item = webResultToRawJobItem({
          title: `Battery Research Scientist - ${segment}`,
          url: "https://example.test/careers/job/9913?page=2",
          snippet: "Open position in battery R&D. Apply now.",
        });
        expect(item).not.toBeNull();
        expect(item?.company).toBeUndefined();
      },
    );

    // THE must-survive cases, and the reason the check is anchored to the whole
    // segment. Every one of these is a real company whose name BEGINS with a
    // word the guard rejects on its own. An unanchored check would delete all
    // four employers.
    it.each([
      "Home Depot",
      "Page Industries",
      "First Solar",
      "Next Energy Technologies",
      "Idaho National Laboratory",
      "Battery Ventures",
    ])("keeps the real employer %s", (company) => {
      const item = webResultToRawJobItem({
        title: `Battery Research Scientist - ${company}`,
        url: "https://example.test/careers/job/9912",
        snippet: "Open position in battery R&D. Apply now.",
      });
      expect(item?.company).toBe(company);
    });

    // Ruling 32 from the render side: absence, not a placeholder. Both the job
    // card and the feed tile guard on companyOrLab, so the employer line is
    // omitted entirely rather than showing anything rejected.
    // RESTATED BY B14-01 (round 14), NOT DELETED. Its subject is
    // `looksLikeNavChrome`, not the host, so repointing the URL preserves what
    // it actually tests. It used the openmc forum URL, which B14-01 now drops
    // before the employer chain runs; `expect(item).not.toBeNull()` would have
    // failed loudly. The contract asserted here — absence, not a placeholder —
    // is unchanged.
    it("leaves the employer absent when only nav chrome survives", () => {
      const item = webResultToRawJobItem({
        title: "Battery Research Scientist - Page 2",
        url: "https://example.test/careers/job/9912",
        snippet: "Open position in battery R&D. Apply now.",
      });
      expect(item).not.toBeNull();
      expect(item?.company).toBeUndefined();
    });
  });

  // B12-07 (round 12): the same widening, seen through the real entry point.
  // talents.vaia.com rendered "Talents by Vaia" as the employer — the job
  // board's own composed brand, sitting in the slot meant for who is hiring.
  describe("job board brand spanning two DNS labels (B12-07)", () => {
    it("does not mistake a two-label board brand for the employer", () => {
      const item = webResultToRawJobItem({
        title: "Postdoctoral Research Associate - Talents by Vaia",
        url: "https://talents.vaia.com/companies/savannah-river-national-laboratory/jobs/1234",
        snippet: "Postdoctoral position in molten salt chemistry. Apply now.",
      });
      expect(item?.company).toBeUndefined();
    });

    // THE must-survive: the SAME host, the SAME posting, with the provider's
    // other title variant — the one that names the real employer. B12-08
    // established the provider alternates between these two titles for this
    // one URL, so both have to behave correctly or the fix trades one wrong
    // value for another.
    it("keeps the real employer on that same host and posting", () => {
      const item = webResultToRawJobItem({
        title: "Postdoctoral Research Associate at Savannah River National Laboratory",
        url: "https://talents.vaia.com/companies/savannah-river-national-laboratory/jobs/1234",
        snippet: "Postdoctoral position in molten salt chemistry. Apply now.",
      });
      expect(item?.company).toBe("Savannah River National Laboratory");
    });
  });

  // B5-03 (round 5): all three of A's real jobs wrongly showed a job board's
  // own brand name or a bare location as the company. Neither shape is a
  // known job-board *domain*, so `KNOWN_JOB_BOARD_DOMAINS` never caught
  // either — both need their own guard.
  it("does not mistake a job board's own brand name for the company", () => {
    const item = webResultToRawJobItem({
      title: "Battery R&D Intern - GreenJobsBoard",
      url: "https://greenjobsboard.io/careers/job/9912",
      snippet: "Research internship in molten salt battery R&D. Apply now.",
    });
    expect(item?.company).toBeUndefined();
  });

  it("does not mistake a bare city/state location segment for the company", () => {
    const item = webResultToRawJobItem({
      title: "Battery R&D Intern - Cambridge, MA",
      url: "https://acme.test/careers/job/9913",
      snippet: "Research internship in molten salt battery R&D. Apply now.",
    });
    expect(item?.company).toBeUndefined();
  });

  // Confirms the new host-brand guard is one-directional, per its own
  // comment in shared.ts: a real company's display name legitimately shares
  // a root with its own domain (the domain label is a short PREFIX of a
  // longer, real name) and must not be rejected the same way a job board's
  // own, longer-or-equal brand is.
  it("keeps a real company name that merely shares a root with its own domain", () => {
    const item = webResultToRawJobItem({
      title: "Battery R&D Intern - Acme Materials Group",
      url: "https://acme.test/careers/job/9914",
      snippet: "Research internship in molten salt battery R&D. Apply now.",
    });
    expect(item?.company).toBe("Acme Materials Group");
  });

  // B6-04 (round 6): title-based employer evidence must use the same guarded
  // candidate pool and take precedence over a trailing job-board label.
  it("extracts an employer stated after 'at' without a punctuation separator", () => {
    const item = webResultToRawJobItem({
      title: "Battery Engineering Internship at Tesla",
      url: "https://ev.careers/jobs/9915",
      snippet: "Battery research internship. Apply now.",
    });
    expect(item?.company).toBe("Tesla");
  });

  it("does not treat a lowercase phrase after 'at' as an employer", () => {
    const item = webResultToRawJobItem({
      title: "Battery Researcher based at our campus",
      url: "https://acme.test/careers/job/9916",
      snippet: "Battery research position. Apply now.",
    });
    expect(item?.company).toBeUndefined();
  });

  it("prefers a title-stated employer over a trailing job-board brand", () => {
    const item = webResultToRawJobItem({
      title: "Battery Engineering Internship at Tesla | EV.Careers",
      url: "https://ev.careers/jobs/9917",
      snippet: "Battery research internship. Apply now.",
    });
    expect(item?.company).toBe("Tesla");
  });

  // B8-01 (round 8): the pre-fix character class had no space, so it could
  // only ever match a one-word employer. Round 6's own regression test used
  // "at Tesla" - one word - so the bug shipped undetected for two rounds
  // (Ruling 31). This is the hardest shape for that bug specifically: a
  // real, multi-word research employer, immediately followed by a trailing
  // " - Brand" segment the multi-word match must win against. Mirrors the
  // live example B8-01 traced ("... at Savannah River National Laboratory
  // - Vaia" wrongly producing "Vaia").
  it("extracts a multi-word employer stated after 'at', preferring it over a trailing brand", () => {
    const item = webResultToRawJobItem({
      title: "Postdoctoral Researcher at Idaho National Laboratory - LabCareers",
      url: "https://labcareers.test/jobs/9918",
      snippet: "Postdoctoral research position. Apply now.",
    });
    expect(item?.company).toBe("Idaho National Laboratory");
  });

  // B8-01: the punctuated hardest-case. A real employer name legitimately
  // carries internal punctuation (comma, period) that the character class
  // already allowed pre-fix; this confirms the multi-word widening did not
  // disturb that and still stops at the trailing separator, not inside the
  // punctuated name.
  it("extracts a punctuated multi-word employer (comma and abbreviation) stated after 'at'", () => {
    const item = webResultToRawJobItem({
      title: "Research Fellow at Alphabet, Inc. - Remote",
      url: "https://alphabet.test/careers/job/9919",
      snippet: "Research fellowship. Apply now.",
    });
    expect(item?.company).toBe("Alphabet, Inc.");
  });

  // B8-01: the "should match nothing" hardest case, and the one that is
  // easiest to get wrong when "fixing" this bug. A title with a multi-word
  // employer but NO trailing punctuation at all - just ordinary lowercase
  // prose running on after it - has no honest boundary between the employer
  // name and the rest of the sentence. The naive fix (widen the character
  // class to include a bare space) was tried first and failed this exact
  // case: it captured "Bell Labs remote position with great benefits" as
  // the employer, trading a silent absence for wrong data. The shipped fix
  // requires each additional word to be Title-Case or a small closed
  // connector ("of"/"and"/"for"/"the"/"&"), so it cannot extend past "Bell
  // Labs", and with no separator or end-of-string to close on, the whole
  // match correctly fails rather than guessing.
  it("does not swallow unpunctuated trailing prose into a multi-word employer", () => {
    const item = webResultToRawJobItem({
      title: "Postdoc at Bell Labs remote position with great benefits",
      url: "https://belllabs.test/careers/job/9920",
      snippet: "Postdoctoral research position. Apply now.",
    });
    expect(item?.company).toBeUndefined();
  });

  // B9-02a (round 9): inl.referrals.selectminds.com's live repro. The real
  // employer name clears every guard above cleanly (it is not a job board,
  // season label, bare location, or host-brand collision) but still carries
  // a careers-page suffix nothing stripped before this fix. Multi-word
  // hardest case per Ruling 31, matching the live shape B traced.
  it("strips a trailing careers-page suffix from an otherwise-real multi-word employer", () => {
    const item = webResultToRawJobItem({
      title: "Battery Research Scientist - Idaho National Laboratory Careers",
      url: "https://inl.referrals.selectminds.com/jobs/12345",
      snippet: "Battery research position. Apply now.",
    });
    expect(item?.company).toBe("Idaho National Laboratory");
  });

  // B9-02a: the punctuated hardest case. The strip must remove only the
  // trailing chrome word, not the punctuation that legitimately belongs to
  // the real employer name sitting in front of it.
  it("strips trailing careers-page chrome without disturbing punctuation inside the real name", () => {
    const item = webResultToRawJobItem({
      title: "Research Fellow - Alphabet, Inc. Careers",
      url: "https://alphabet.test/careers/job/9921",
      snippet: "Research fellowship. Apply now.",
    });
    expect(item?.company).toBe("Alphabet, Inc.");
  });

  // B9-02a: the "should match nothing" hardest case, and the one this fix
  // is most likely to get wrong. A real, longer employer name that happens
  // to end in an ordinary word must survive untouched - only the closed
  // careers/jobs/employment vocabulary strips, never a general "trailing
  // capitalised word" rule that would eat a name like this one.
  it("does not strip a real trailing word that is not careers-page chrome", () => {
    const item = webResultToRawJobItem({
      title: "Research Fellow - State University Board of Regents",
      url: "https://stateu.test/careers/job/9922",
      snippet: "Research fellowship. Apply now.",
    });
    expect(item?.company).toBe("State University Board of Regents");
  });
});

describe("company derivation — hosting-platform boilerplate phrase (B10-01, item 2)", () => {
  // B10-01's live repro (postdocjobs.com): `looksLikeHostBrand` never
  // rejects this — it is deliberately one-directional and only rejects a
  // candidate no LONGER than a host DNS label, and "Job posted on
  // PostdocJobs.com" is far longer than "postdocjobs". This is the
  // must-now-reject case the new check exists for.
  it("does not mistake a hosting-platform's own posting boilerplate for the company", () => {
    const item = webResultToRawJobItem({
      title: "Postdoctoral Fellow | Job posted on PostdocJobs.com",
      url: "https://postdocjobs.com/job/999003",
      snippet: "Postdoctoral research position. Apply now.",
    });
    expect(item?.company).toBeUndefined();
  });

  // Same shape, a different closed phrase from the same list.
  it.each([
    "Posted by PostdocJobs.com",
    "Listing on PostdocJobs.com",
    "See more jobs at PostdocJobs.com",
  ])("rejects another hosting-platform boilerplate phrasing: %s", (phrase) => {
    const item = webResultToRawJobItem({
      title: `Postdoctoral Fellow | ${phrase}`,
      url: "https://postdocjobs.com/job/999004",
      snippet: "Postdoctoral research position. Apply now.",
    });
    expect(item?.company).toBeUndefined();
  });

  // Must-survive: a real, non-boilerplate-shaped multi-word employer name
  // must be completely unaffected by this new check (INL's own real name,
  // already covered above, re-asserted here as the cross-check that this
  // item's addition did not narrow it).
  it("keeps a real multi-word employer name that is not boilerplate-shaped", () => {
    const item = webResultToRawJobItem({
      title: "Battery Research Scientist - Idaho National Laboratory Careers",
      url: "https://inl.referrals.selectminds.com/jobs/12346",
      snippet: "Battery research position. Apply now.",
    });
    expect(item?.company).toBe("Idaho National Laboratory");
  });

  // Must-not-overreach (item 1 stays open, on purpose): "University of
  // Pennsylvania" is a real, grammatical organisation name, not shaped like
  // "Job posted on X"/"Posted by X"/etc. This check must NOT fire on it —
  // item 1's harder "real name, wrong institution" residual is a flagged
  // POLICY question (§1 MANAGER CARRY-FORWARD), not something this closed
  // phrase check may silently absorb.
  it("does not fire on a real organisation name merely because it is long (item 1 stays open)", () => {
    const item = webResultToRawJobItem({
      title: "Postdoctoral Researcher - University of Pennsylvania",
      url: "https://careerservices.upenn.edu/job/12347",
      snippet: "Postdoctoral research position. Apply now.",
    });
    expect(item?.company).toBe("University of Pennsylvania");
  });
});

describe("company derivation with the profile's own topics (B9-02b/c)", () => {
  const topics = ["molten salt", "battery"];

  // B9-02b: postdocjobs.com's live repro. Multi-word hardest case per
  // Ruling 31 - the topic followed by a multi-word academic-field
  // continuation ("Chemical and Electrochemical Engineering").
  it("does not mistake a topic-prefixed research-field label for the company (postdocjobs.com shape)", () => {
    const item = webResultToRawJobItem(
      {
        title: "Postdoctoral Fellow - Molten Salt Chemical and Electrochemical Engineering",
        url: "https://postdocjobs.com/job/999001",
        snippet: "Postdoctoral research position. Apply now.",
      },
      topics,
    );
    expect(item?.company).toBeUndefined();
  });

  // B9-02c: careerservices.upenn.edu's live repro, unchanged across two
  // rounds before this fix - the simpler of the two live shapes, the topic
  // followed by a single field noun.
  it("does not mistake a topic-prefixed research-field label for the company (careerservices.upenn.edu shape)", () => {
    const item = webResultToRawJobItem(
      {
        title: "Research Associate - Molten Salt Characterization",
        url: "https://careerservices.upenn.edu/jobs/12345",
        snippet: "Research position in molten salt characterization. Apply now.",
      },
      topics,
    );
    expect(item?.company).toBeUndefined();
  });

  // The "should match nothing" hardest case, named explicitly in B's own
  // guide: a real employer name that happens to share a word with a search
  // topic must survive. The topic is not a PREFIX of this candidate (it
  // sits in the middle), and "Technologies" is not in the closed
  // field-vocabulary list either - two independent reasons it survives.
  it("does not reject a real employer name that merely shares a word with a topic", () => {
    const item = webResultToRawJobItem(
      {
        title: "Battery R&D Intern - Acme Molten Salt Technologies",
        url: "https://acme.test/careers/job/9930",
        snippet: "Research internship in molten salt battery R&D. Apply now.",
      },
      topics,
    );
    expect(item?.company).toBe("Acme Molten Salt Technologies");
  });

  // The other "must survive" case B named: a multi-word employer sharing no
  // words with any topic at all is trivially unaffected.
  it("does not reject a multi-word employer name sharing no words with any topic", () => {
    const item = webResultToRawJobItem(
      {
        title: "Battery R&D Intern - Idaho National Laboratory",
        url: "https://inl.jobs/careers/job/9931",
        snippet: "Research internship in molten salt battery R&D. Apply now.",
      },
      topics,
    );
    expect(item?.company).toBe("Idaho National Laboratory");
  });

  // Additive and optional, per this loop's own standing contract: the
  // identical postdocjobs.com-shaped candidate above, with NO topics
  // supplied at all, must reproduce exactly today's pre-fix behaviour -
  // proving the new guard cannot fire unless a caller opts in.
  it("does not apply the topic-label guard when no topics are supplied", () => {
    const item = webResultToRawJobItem({
      title: "Postdoctoral Fellow - Molten Salt Chemical and Electrochemical Engineering",
      url: "https://postdocjobs.com/job/999001",
      snippet: "Postdoctoral research position. Apply now.",
    });
    expect(item?.company).toBe("Molten Salt Chemical and Electrochemical Engineering");
  });
});

describe("listing titles hidden behind site chrome", () => {
  it("rejects a careers index whose label is only the first title segment", () => {
    expect(
      webResultToRawJobItem({
        title: "CAREER | Acme Materials",
        url: "https://acme.test/careers",
        snippet: "Research scientist openings. Apply now.",
      }),
    ).toBeNull();
  });

  it("keeps a real role that carries site chrome", () => {
    const item = webResultToRawJobItem({
      title: "Battery Research Scientist | Acme Materials",
      url: "https://acme.test/careers/job/9912",
      snippet: "Open position in battery R&D. Apply now.",
    });
    expect(item).not.toBeNull();
    expect(item!.title).toBe("Battery Research Scientist");
  });
});

// B13-01 Gap A (round 13): a BARE careers-section label reached the employer
// slot. `CAREERS_INDEX_TITLE_RE` — the closed, anchored list that names exactly
// this class — is defined in the same source file and was applied only to the
// whole title and to `roleTitle`, never to an employer candidate.
//
// EVIDENCE CLASS: this gap is LATENT, not live. Round 13 A's census contains no
// `Careers` employer render; B found it by executing the chain against
// breadcrumb shapes. Recorded here so no later round logs it as a
// live-confirmed defect.
//
// GAP B (`Announcements` on openmc.discourse.group) IS NOT FIXED and must not
// be — Ruling 42a defers it to Ruling 39c's forum-thread drop. There is no
// assertion for it here, deliberately.
describe("careers-section label in the employer slot (B13-01 Gap A)", () => {
  it.each(["Careers", "Jobs", "Vacancies", "Employment", "Open Positions", "Join our team"])(
    "does not mistake the bare section label %s for the employer",
    (label) => {
      const item = webResultToRawJobItem({
        title: `Battery Research Scientist - ${label} - Idaho National Laboratory`,
        url: "https://inl.test/careers/job/9940",
        snippet: "Open position in battery R&D. Apply now.",
      });
      expect(item?.company).toBe("Idaho National Laboratory");
    },
  );

  it("omits the employer when the section label is the only candidate", () => {
    const item = webResultToRawJobItem({
      title: "Battery Research Scientist - Careers",
      url: "https://inl.test/careers/job/9941",
      snippet: "Open position in battery R&D. Apply now.",
    });
    expect(item).not.toBeNull();
    // Ruling 32 from the render side, and B13-01 corrected B12-06's count:
    // FOUR render sites omit the employer line rather than substituting
    // anything — job-card.tsx:87 and feed-tile.tsx:535 guard on
    // `companyOrLab`; briefing-hero.tsx:133 and briefing-quick-hit.tsx:49
    // `.filter(Boolean).join(" · ")`, so the separator goes with the value.
    expect(item?.company).toBeUndefined();
  });

  // MUST-KEEP, AND THE REASON THE REGEX'S WHOLE-SEGMENT ANCHOR IS LOAD-BEARING.
  // Every one of these is a real company whose name CONTAINS a word the list
  // rejects on its own. An unanchored version would delete all of them.
  it.each([
    "Home Depot",
    "Page Industries",
    "First Solar",
    "Next Energy Technologies",
    "Careers Australia Group",
    "Open Society Foundations",
  ])("keeps the real employer %s through the new clause", (company) => {
    const item = webResultToRawJobItem({
      title: `Battery Research Scientist - ${company}`,
      url: "https://example.test/careers/job/9942",
      snippet: "Open position in battery R&D. Apply now.",
    });
    expect(item?.company).toBe(company);
  });

  // The `at`-captured employer path reaches the same veto chain, so the guard
  // must hold there too rather than only on punctuation segments.
  it("does not accept a section label captured after 'at'", () => {
    const item = webResultToRawJobItem({
      title: "Battery Research Scientist at Careers",
      url: "https://example.test/careers/job/9943",
      snippet: "Open position in battery R&D. Apply now.",
    });
    expect(item?.company).toBeUndefined();
  });
});

// B13-02 (round 13): four items in round 13 A's live pool were not job
// postings at all. NONE of isListingPage's five existing checks fired on ANY
// of them — verified by execution before the design, not assumed. They are
// THREE distinct holes in that one function, and each addition below carries
// exactly one of A's instances, with no overlap.
//
// WHAT RENDERS WHEN ONE OF THESE IS DROPPED: NOTHING. isListingPage returning
// true makes webResultToRawJobItem return null; both search functions filter
// nulls before returning; the item never reaches dedup, scoring, the mapper or
// any card. There is no placeholder, no substitution and no backfill —
// buildDailyJobPool ends with a `.slice()` CAP, never a top-up. The pool
// simply shrinks (4 of 20 items on round 13's sample, ~20%). That is the fix
// working, not the pipeline degrading: those four occupied slots a real
// posting could have had.
describe("non-posting pool items (B13-02)", () => {
  describe("hole 1 — a count with a thousands separator", () => {
    // A's live instance: linkedin.com/jobs/molten-salt-jobs rendered this as
    // its role title. `1000+ …` fired today; ONE COMMA defeated the whole
    // alternative.
    it("rejects a live thousands-separated aggregate count", () => {
      expect(
        isListingPage(
          "1,000+ Molten Salt jobs in United States",
          "linkedin.com",
          "/jobs/molten-salt-jobs",
        ),
      ).toBe(true);
    });

    it("rejects a five-digit thousands-separated count", () => {
      expect(
        isListingPage(
          "10,000 Battery Engineer positions in Germany",
          "example.test",
          "/jobs",
        ),
      ).toBe(true);
    });

    // REGRESSION LOCK on the alternation shape. These three are the cases B's
    // own first draft (`\d{1,3}(?:,\d{3})*`) silently lost — with the comma
    // group optional, `\d{1,3}` can never consume a 4- or 5-digit run. If a
    // later round "tidies" the regex into a single group, these fail.
    it.each([
      "1000+ Molten Salt jobs in United States",
      "12345 vacancies",
      "999 Battery Openings",
    ])("still rejects the plain-number count form: %s", (title) => {
      expect(isListingPage(title, "example.test", "/jobs")).toBe(true);
    });
  });

  describe("hole 2 — a syndication endpoint is never one posting", () => {
    // A's live instance: an author RSS feed ingested as a job, whose role
    // title rendered as the bare host slug `lco-cdo`.
    it("rejects a live author RSS feed URL", () => {
      expect(
        isListingPage("lco-cdo", "lco-cdo.org", "/en/author/lco_admin/feed/"),
      ).toBe(true);
    });

    it.each([
      "/blog/feed",
      "/rss/",
      "/news/atom",
      "/updates.rss",
      "/index.xml",
      "/news/?feed=rss2",
    ])("rejects the syndication endpoint %s", (pathAndQuery) => {
      expect(
        isListingPage("Battery Research Scientist", "example.test", pathAndQuery),
      ).toBe(true);
    });

    // MUST-KEEP: real-shaped posting slugs that merely CONTAIN a feed token as
    // a substring. This is why the check is anchored to whole path segments —
    // an unanchored version deletes all four of these real postings.
    it.each([
      "/jobs/feedstock-process-engineer",
      "/careers/rss-platform-engineer",
      "/jobs/atomic-layer-deposition-scientist",
      "/jobs/feeder-line-technician",
    ])("keeps a real posting whose slug contains a feed token: %s", (pathAndQuery) => {
      expect(
        isListingPage("Battery Research Scientist", "example.test", pathAndQuery),
      ).toBe(false);
    });
  });

  describe("hole 3 — a title that names a section, not a role", () => {
    // A's two live instances: two views of one board's listing page.
    it.each([
      ["Intern Jobs at Battery Ventures Companies", "/jobs?jobTypes=Intern"],
      ["Jobs at Battery Ventures Companies", "/jobs?jobTypes="],
    ])("rejects the live board listing view: %s", (title, pathAndQuery) => {
      expect(isListingPage(title, "jobs.battery.com", pathAndQuery)).toBe(true);
    });

    it.each([
      "Vacancies at CERN",
      "Careers with Acme Materials",
      "Openings in Materials Science",
    ])("rejects the section-title form: %s", (title) => {
      expect(isListingPage(title, "example.test", "/jobs")).toBe(true);
    });

    // MUST-KEEP, AND THE REASON `for` IS NOT IN THE PREPOSITION LIST. B's
    // first draft included it and these three real role titles were destroyed
    // — 3 of 15. Do not add `for` back.
    it.each([
      "Jobs for Veterans Program Manager",
      "Job for a Battery Engineer",
      "Career for Life Coordinator",
    ])("keeps a real role title using the preposition 'for': %s", (title) => {
      expect(isListingPage(title, "example.test", "/careers/role")).toBe(false);
    });

    // MUST-KEEP traps: a role that BEGINS with `Jobs` (the preposition must
    // follow the section word immediately), and `positions`, deliberately
    // absent from the section-word list because real postings use it.
    it.each([
      "Jobs Data Analyst at the Bureau of Labor Statistics",
      "Research positions at CERN",
      "Career Development Scientist at Acme",
    ])("keeps the real posting title: %s", (title) => {
      expect(isListingPage(title, "example.test", "/careers/role")).toBe(false);
    });
  });

  // RESTATED BY B14-01 (round 14), NOT DELETED. This assertion was written by
  // round 13 C to catch exactly a change that took Ruling 39c's DEFERRED drop
  // without a ruling — its comment said "if a future change makes this fail,
  // that change is taking a deferred decision without a ruling."
  //
  // RULING 43 IS THAT RULING. It authorises and requires the drop, and the
  // manager's round-14 verification of Agent B endorsed the URL-route
  // instrument specifically. So the contract inverts: the openmc forum thread
  // must now be dropped, and the test that guarded the old contract states the
  // new one instead of being removed.
  it("drops the openmc forum thread — Ruling 43 authorises it, B14-01 implements it", () => {
    expect(
      isListingPage(
        "Job vacancies looking for OpenMC skills - Page 2 - OpenMC Discourse",
        "openmc.discourse.group",
        "/t/job-vacancies/1234?page=2",
      ),
    ).toBe(true);
  });

  // Eleven live-confirmed real postings from round 13 A's own census must all
  // still survive all three additions.
  it.each([
    ["Postdoctoral Research Associate - Talents by Vaia", "talents.vaia.com", "/companies/savannah-river-national-laboratory/jobs/1234"],
    ["Project and Website Coordinator", "lco-cdo.org", "/en/jobs/project-and-website-coordinator/"],
    ["2027 Summer Investment Internship", "employbl.com", "/jobs/2027-summer-investment-internship-battery-ventures-1410243"],
    ["Battery Research Scientist", "careers.inl.gov", "/job/12345"],
    ["Internship Battery R&D", "hyetlithium.com", "/careers/internship-battery-research"],
  ])("keeps the live posting %s", (title, host, pathAndQuery) => {
    expect(isListingPage(title, host, pathAndQuery)).toBe(false);
  });

  // B14-01 (round 14, Ruling 43): the forum-thread route rule, asserted as B's
  // own 58-case adversarial matrix — 15 must-drop and 43 must-keep. B scored
  // the recommended design 57/58: every must-keep survives with ZERO false
  // fires, and 14 of the 15 must-drops are caught. The fifteenth is the
  // deliberate named miss asserted at the bottom of this block.
  //
  // Every case here uses a TITLE THAT IS NOT ITSELF A LISTING TITLE, so a pass
  // can only come from the URL rule — otherwise a must-drop could go green on
  // `LISTING_TITLE_RE` and this block would prove nothing about B14-01.
  describe("forum threads are not postings (B14-01, Ruling 43)", () => {
    // THE 14 CAUGHT MUST-DROPS. Three forum-software routing conventions:
    // Discourse `/t/[<slug>/]<id>[/<post>]`, the phpBB/vBulletin script
    // filenames, and XenForo's `/threads/<slug>.<id>`.
    it.each([
      // Discourse — the live shape and its recorded siblings
      ["live openmc thread", "openmc.discourse.group", "/t/job-vacancies-looking-for-openmc-skills/1727?page=2"],
      ["openmc page-1 shape", "openmc.discourse.group", "/t/job-vacancies-looking-for-openmc-skills/1727"],
      ["the shipped suite's openmc URL", "openmc.discourse.group", "/t/job-vacancies/1234?page=2"],
      ["a bare topic id", "openmc.discourse.group", "/t/1727"],
      ["a post permalink", "openmc.discourse.group", "/t/job-vacancies-looking-for-openmc-skills/1727/14"],
      ["a trailing-slash form", "openmc.discourse.group", "/t/job-vacancies/1234/"],
      // Discourse is a PLATFORM, not a site — a host list would not have closed
      // this item. These two are the concrete reason.
      ["another Discourse host", "discuss.example.org", "/t/hiring-postdocs/8891"],
      ["a SUBFOLDER Discourse install", "example.test", "/community/t/hiring-postdocs/8891"],
      // phpBB / vBulletin — literal script filenames
      ["phpBB viewtopic.php", "forum.example.test", "/viewtopic.php?t=1234"],
      ["phpBB viewforum.php", "forum.example.test", "/viewforum.php?f=12"],
      ["vBulletin showthread.php", "forum.example.test", "/showthread.php?t=1234"],
      ["vBulletin forumdisplay.php", "forum.example.test", "/forumdisplay.php?f=12"],
      // XenForo — the `.` + id suffix is REQUIRED, never the bare word
      ["XenForo /threads/<slug>.<id>", "forum.example.test", "/threads/hiring-battery-postdocs.8891/"],
      // This suite's own idea of a forum thread URL. It is the reason the
      // Discourse alternative is NOT anchored to `^/t/` — that draft scored
      // 55/58 because it missed this and subfolder installs.
      ["this suite's own forum URL", "example.test", "/forum/t/thread/1?page=2"],
    ])("drops %s", (_label, host, pathAndQuery) => {
      expect(isListingPage("Battery Research Scientist", host, pathAndQuery)).toBe(true);
    });

    // THE 43 MUST-KEEPS — 20 real postings from A's censuses (rounds 11–14) and
    // this suite, then 23 adversarial shapes B wrote to break its own draft.
    // ZERO false fires is the property that matters here: a guard's false fire
    // leaves a field empty, but a DROP's false fire destroys a whole real
    // posting. That asymmetry is why the design gave up a matrix point.
    it.each([
      // --- 20 real postings ---
      ["talents.vaia.com", "talents.vaia.com", "/companies/savannah-river-national-laboratory/jobs/1234"],
      ["lco-cdo.org coordinator posting", "lco-cdo.org", "/en/jobs/project-and-website-coordinator/"],
      ["employbl.com", "employbl.com", "/jobs/2027-summer-investment-internship-battery-ventures-1410243"],
      ["careers.inl.gov", "careers.inl.gov", "/job/12345"],
      // isListingPage's own doc-comment must-keep — a real posting with NO id.
      ["hyetlithium.com", "hyetlithium.com", "/careers/internship-battery-research"],
      ["inl.referrals.selectminds.com", "inl.referrals.selectminds.com", "/jobs/12345"],
      ["careerservices.upenn.edu", "careerservices.upenn.edu", "/job/12347"],
      ["postdocjobs.com", "postdocjobs.com", "/job/999003"],
      ["ev.careers", "ev.careers", "/jobs/battery-cell-engineer-1234"],
      ["careers.gevernova.com", "careers.gevernova.com", "/global/en/job/GEVEGLOBAL12345/Battery-Engineer"],
      ["grad.wisc.edu", "grad.wisc.edu", "/funding/graduate-assistantship-battery-research/"],
      ["a linkedin.com deep posting", "linkedin.com", "/jobs/view/battery-research-scientist-at-acme-4123456789"],
      ["terra.do", "terra.do", "/climate-jobs/battery-systems-engineer/"],
      ["mykelly.com", "mykelly.com", "/job/battery-lab-technician-1234567/"],
      // Round 14 A's part-2 Finding 4 observation. B14-01 does not touch it —
      // it is an internships index, not a forum thread, and closing it (if it
      // is ever ruled a defect) is a different item.
      ["lco.global/about/interns", "lco.global", "/about/interns"],
      ["jobs.lbl.gov", "jobs.lbl.gov", "/jobs/battery-materials-postdoc-1234"],
      ["jobs.ac.uk", "jobs.ac.uk", "/job/DKL123/postdoctoral-research-associate-in-battery-science"],
      ["a Greenhouse board deep link", "boards.greenhouse.io", "/acmebattery/jobs/4123456"],
      ["this suite's ziprecruiter deep link", "ziprecruiter.com", "/c/Acme/Job/Battery-Scientist/-in-San-Jose?jid=1234567"],
      ["careers.inl.gov, second posting", "careers.inl.gov", "/job/12346"],
      // --- 23 adversarial shapes: forum tokens as ordinary slug substrings ---
      // These 8 are the naive token-only draft's false fires. That draft scored
      // 46/58 and destroyed real postings; do not simplify the rule back to it.
      ["threading-machine-operator", "example.test", "/jobs/threading-machine-operator"],
      ["topical-drug-formulation-scientist", "example.test", "/jobs/topical-drug-formulation-scientist"],
      ["discourse-analysis-researcher", "example.test", "/careers/discourse-analysis-researcher"],
      ["viewtopic-ux-designer", "example.test", "/careers/viewtopic-ux-designer"],
      ["t-shirt-designer", "example.test", "/t-shirt-designer/jobs/1234"],
      ["threads-of-innovation", "example.test", "/threads-of-innovation/careers/1234"],
      ["forum/careers", "example.test", "/forum/careers/battery-scientist"],
      ["topics/battery", "example.test", "/topics/battery/jobs/1234"],
      // These prove the CONFIRMING STRUCTURAL TOKEN requirement: a `/t/`
      // segment with no id, digits with no segment boundary, a dot with no id,
      // and a `.php` that is not one of the four forum scripts.
      ["a /t/ segment with NO id", "example.test", "/t/battery-research-scientist"],
      ["digits with no segment boundary", "example.test", "/t/2026-battery-intern"],
      ["a dot with no id", "example.test", "/threads/hiring.today"],
      ["a .php that is not a forum script", "example.test", "/careers/apply.php?id=1234"],
      ["another non-forum .php", "example.test", "/jobs/viewjob.php?id=99"],
      ["/topic/ with a non-id slug", "example.test", "/topic/battery-research/jobs/1234"],
      ["bare /threads/ with no id", "example.test", "/threads/battery-careers"],
      ["bare /thread/ singular", "example.test", "/thread/battery-jobs"],
      ["/topics/ with no id", "example.test", "/forums/topics/battery"],
      ["a /t segment at the end with no id", "example.test", "/careers/t"],
      ["a /t/ segment naming a team", "example.test", "/about/t/team"],
      ["threadneedle in a slug", "example.test", "/jobs/threadneedle-street-analyst"],
      ["showthread in a slug", "example.test", "/careers/showthread-content-strategist"],
      ["forumdisplay in a slug", "example.test", "/careers/forumdisplay-engineer"],
      ["a numeric team path", "example.test", "/team/1234/battery-scientist"],
    ])("keeps %s", (_label, host, pathAndQuery) => {
      expect(isListingPage("Battery Research Scientist", host, pathAndQuery)).toBe(false);
    });

    // THE FIFTEENTH MUST-DROP, DELIBERATELY MISSED. Adding NodeBB/Invision's
    // `/topic/<id>` scores 58/58 instead of 57/58 and is still wrong: its
    // true-fire shape and its false-fire shapes are BOTH `/topic/<digits>-<slug>`
    // and no structural test separates them — a four-digit year is a four-digit
    // id, so raising the digit floor does not help. The two false-fire shapes
    // are asserted underneath. Assert the miss so that widening this rule later
    // is a deliberate act with its own evidence, not a drift.
    it("does NOT drop a NodeBB/Invision thread — a deliberate, named miss", () => {
      expect(
        isListingPage("Battery Research Scientist", "forum.example.test", "/topic/8891-hiring-battery-postdocs/"),
      ).toBe(false);
    });

    it.each([
      "/topic/12-month-battery-fellowship",
      "/topic/2026-summer-internship",
    ])("is why NodeBB was cut — %s is a real posting sharing that shape", (pathAndQuery) => {
      expect(isListingPage("Battery Research Scientist", "example.test", pathAndQuery)).toBe(false);
    });

    // TITLE-INDEPENDENCE — the property that made the URL route beat every
    // string-side design tried across six rounds, and how Ruling 43's "both
    // observed shapes, not one string" is satisfied. All five recorded title
    // shapes for this one page drop from the same URL rule, INCLUDING the
    // `Users` shape that did not appear in round 14's census. A sixth title
    // shape appearing tomorrow drops too, because the rule never reads a title.
    it.each([
      ["paginated Announcements (live round 14, 5/5)", "Job vacancies looking for OpenMC skills - Page 2 - Announcements - OpenMC"],
      ["page-1 Announcements", "Job vacancies looking for OpenMC skills - Announcements - OpenMC"],
      ["the Users shape (recorded round 13)", "Job vacancies looking for OpenMC skills - Page 2 - Users - OpenMC Discourse"],
      ["the round 12 pipe-separated variant", "Job vacancies looking for OpenMC skills | Page 2 | OpenMC"],
      ["the no-category variant", "Job vacancies looking for OpenMC skills - Page 2 - OpenMC Discourse"],
    ])("drops the openmc thread regardless of title shape: %s", (_label, title) => {
      expect(
        isListingPage(title, "openmc.discourse.group", "/t/job-vacancies-looking-for-openmc-skills/1727?page=2"),
      ).toBe(true);
    });

    // RULING 32's QUESTION, ANSWERED FROM THE RENDER SIDE: when this fires the
    // item never exists, so there is no field to fill and nothing rejected can
    // be reinserted. The pool simply shrinks by one — `buildDailyJobPool` ends
    // in a `.slice()` CAP, never a top-up, so no substitute is pulled in.
    it("produces no item at all when it fires, so no employer can be derived", () => {
      const item = webResultToRawJobItem({
        title: "Job vacancies looking for OpenMC skills - Page 2 - Announcements - OpenMC",
        url: "https://openmc.discourse.group/t/job-vacancies-looking-for-openmc-skills/1727?page=2",
        snippet: "Several groups are hiring for molten salt reactor work. Apply now.",
      });
      expect(item).toBeNull();
    });
  });
});
