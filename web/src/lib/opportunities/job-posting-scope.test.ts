import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { resolveJobPostingScope } from "./job-posting-scope";
import { enrichJobCandidates } from "./enrich";
import { scoredJobToJob } from "@/lib/jobs/mapper";
import { scoreIndustryFit } from "@/lib/jobs/scoring";

describe("resolveJobPostingScope", () => {
  it("selects a smallest DOM owner by exact canonical link", () => {
    const scope = resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"https://jobs.example.com/role","jobLocation":{"address":{"addressLocality":"Chicago"}}}</script><article><a href="/role">Selected role</a><p>Owned text.</p></article><article><a href="/other">Foreign role</a><p>Foreign text.</p></article>`,
      { url: "https://jobs.example.com/role", title: "Selected role" },
    );
    expect(scope).toMatchObject({ status: "owned", text: "Selected role Owned text.", structured: { place: { city: "Chicago" } } });
  });

  it("keeps a matching structured record when the page includes surrounding content", () => {
    const scope = resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"https://jobs.example.com/role","jobLocation":{"address":{"addressLocality":"Chicago"}}}</script><article><a href="/role">Selected posting</a><p>Owned text.</p></article><main>${"Detailed opportunity information. ".repeat(800)}</main>`,
      { url: "https://jobs.example.com/role", title: "Solid-State Battery Research Scientist 2" },
    );
    expect(scope).toMatchObject({ status: "owned", structured: { place: { city: "Chicago" } } });
  });

  it("uses the owned scope in enrichment", async () => {
    const html = `<script type="application/ld+json">{"@type":"JobPosting","url":"https://jobs.example.com/role","jobLocation":{"address":{"addressLocality":"Chicago"}}}</script><article><a href="/role">Selected posting</a><p>Owned text.</p></article><main>${"Detailed opportunity information. ".repeat(800)}</main>`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html, { status: 200 })));
    const [item] = await enrichJobCandidates([{
      id: "jobweb:scope", source: "jobweb", title: "Solid-State Battery Research Scientist 2",
      company: "Example Lab", location: "", isRemote: false, description: "raw", url: "https://jobs.example.com/role", tags: [],
    }]);
    expect(item).toMatchObject({ place: { city: "Chicago" }, fetchedPostingScope: "owned" });
    vi.unstubAllGlobals();
  });

  it("normalizes only host case, a trailing slash, and a fragment", () => {
    const scope = resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"https://JOBS.example.com/role/?id=7#apply","description":"Owned description."}</script>`,
      { url: "https://jobs.example.com/role?id=7", title: "Selected role" },
    );
    expect(scope).toMatchObject({ status: "owned", text: "Owned description." });
    expect(resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"https://jobs.example.com/role?id=8","description":"Foreign query."}</script>`,
      { url: "https://jobs.example.com/role?id=7", title: "Selected role" },
    )).toEqual({ status: "unproven" });
  });

  it("uses only the exact-URL JSON-LD fallback when no DOM owner exists", () => {
    const scope = resolveJobPostingScope(
      `<script type="application/ld+json">[{"@type":"JobPosting","url":"https://jobs.example.com/selected","description":"Selected fallback duties.","employmentType":"INTERN"},{"@type":"JobPosting","url":"https://jobs.example.com/foreign","description":"Foreign-marker hybrid visa sponsorship.","employmentType":"FULL_TIME"}]</script><main>Listing shell.</main>`,
      { url: "https://jobs.example.com/selected", title: "Selected internship" },
    );

    expect(scope).toMatchObject({
      status: "owned",
      text: "Selected fallback duties.",
      structured: { employmentType: "intern" },
    });
    expect(scope.status === "owned" && scope.text).not.toContain("Foreign-marker");
  });

  it("fails closed for malformed URLs and distinct matching records", () => {
    expect(resolveJobPostingScope(
      `<script type="application/ld+json">{"@type":"JobPosting","url":"not a URL","description":"Owned."}</script>`,
      { url: "https://jobs.example.com/role", title: "Selected role" },
    )).toEqual({ status: "unproven" });
    expect(resolveJobPostingScope(
      `<script type="application/ld+json">[{"@type":"JobPosting","url":"https://jobs.example.com/role","description":"First."},{"@type":"JobPosting","url":"https://jobs.example.com/role","description":"Second."}]</script>`,
      { url: "https://jobs.example.com/role", title: "Selected role" },
    )).toEqual({ status: "unproven" });
  });

  it("keeps every job-text consumer inside the selected DOM owner", async () => {
    const selectedUrl = "https://jobs.example.com/selected";
    const selectedTitle = "Battery Internship at Example Lab";
    const html = [
      `<script type="application/ld+json">[{"@type":"JobPosting","url":"${selectedUrl}","description":"Selected research duties."},{"@type":"JobPosting","url":"https://jobs.example.com/foreign","description":"Foreign-marker hybrid visa sponsorship.","validThrough":"2030-01-01","baseSalary":{"value":{"minValue":999999,"maxValue":1000000,"unitText":"YEAR"}},"jobLocation":{"address":{"addressLocality":"Elsewhere"}}}]</script>`,
      `<article><h2>${selectedTitle}</h2><p>Selected research duties.</p></article>`,
      `<article><h2>Foreign battery role</h2><p>Foreign-marker hybrid visa sponsorship.</p></article>`,
    ].join("");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(html, { status: 200 })));

    const [item] = await enrichJobCandidates([{
      id: "jobweb:owned-boundary", source: "jobweb", title: selectedTitle,
      company: "Example Lab", location: "", isRemote: false, description: "Raw source description.", url: selectedUrl, tags: [],
    }]);
    const reportJob = scoredJobToJob({
      ...item, score: 0.8, matchedKeywords: [], matchReason: "Relevant.",
    });

    expect(item).toMatchObject({ fetchedPostingScope: "owned", roleKind: "internship" });
    expect(item.pageText).toContain("Selected research duties.");
    expect(item.pageText).not.toContain("Foreign-marker");
    expect(item.workMode).toBeUndefined();
    expect(item.visa).toMatchObject({ state: "not-stated" });
    expect(item.visa?.evidence).toBeUndefined();
    expect(item.place).toBeUndefined();
    expect(item.applicationDeadline).toBeUndefined();
    expect(item.salaryMin).toBeUndefined();
    expect(reportJob.summary).toContain("Selected research duties.");
    expect(reportJob.summary).not.toContain("Foreign-marker");
    vi.unstubAllGlobals();
  });

  it("makes an unproven successful fetch silent while preserving source scoring text byte-for-byte", async () => {
    const description = "University research duties from the selected source.";
    const foreignMarker = "Foreign-marker hybrid visa sponsorship.";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      `<main><article><h2>Different role</h2><p>${foreignMarker}</p></article></main>`,
      { status: 200 },
    )));

    const [item] = await enrichJobCandidates([{
      id: "jobweb:unproven-boundary", source: "jobweb", title: "Selected internship",
      company: "Example Lab", location: "", isRemote: false, description, url: "https://jobs.example.com/selected", tags: [],
    }]);
    const reportJob = scoredJobToJob({
      ...item, score: 0.8, matchedKeywords: [], matchReason: "Relevant.",
    });

    expect(item).toMatchObject({ fetchedPostingScope: "unproven", description });
    expect(item.pageText).toBeUndefined();
    expect(item.description).toBe(description);
    expect(scoreIndustryFit(item, "academia")).toBe(1);
    expect(reportJob.summary).toBeUndefined();
    vi.unstubAllGlobals();
  });
});
