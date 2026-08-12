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

  it("falls back to the host when only a season segment survives", () => {
    const item = webResultToRawJobItem({
      title: "Battery R&D Intern - Summer 2027",
      url: "https://acme.test/careers/job/9912",
      snippet: "Research internship in molten salt battery R&D. Apply now.",
    });
    expect(item?.company).toBe("acme.test");
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
    expect(item?.company).toBe("greenjobsboard.io");
  });

  it("does not mistake a bare city/state location segment for the company", () => {
    const item = webResultToRawJobItem({
      title: "Battery R&D Intern - Cambridge, MA",
      url: "https://acme.test/careers/job/9913",
      snippet: "Research internship in molten salt battery R&D. Apply now.",
    });
    expect(item?.company).toBe("acme.test");
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
    expect(item?.company).toBe("acme.test");
  });

  it("prefers a title-stated employer over a trailing job-board brand", () => {
    const item = webResultToRawJobItem({
      title: "Battery Engineering Internship at Tesla | EV.Careers",
      url: "https://ev.careers/jobs/9917",
      snippet: "Battery research internship. Apply now.",
    });
    expect(item?.company).toBe("Tesla");
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
