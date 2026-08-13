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
