import { describe, expect, it } from "vitest";
import { vi } from "vitest";
import { resolveJobPostingScope } from "./job-posting-scope";
import { enrichJobCandidates } from "./enrich";

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
});
