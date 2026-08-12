import { describe, it, expect } from "vitest";
import { looksLikeHostBrand, routeSafeId, urlHashId } from "./shared";

// Regression guard: source ids flow straight into the single-segment
// /events/[id] and /jobs/[id] routes, so any slash (or other route-breaking
// char) in an id turns the detail page into a 404. Every adapter runs its raw
// id through routeSafeId — these tests lock that contract in.
describe("routeSafeId", () => {
  it("hashes URLs to a slash-free token", () => {
    const id = routeSafeId("https://himalayas.app/companies/helio/jobs/123");
    expect(id).not.toContain("/");
    expect(id).not.toContain(":");
    expect(id).toBe(urlHashId("https://himalayas.app/companies/helio/jobs/123"));
  });

  it("slugifies separators and spaces (no slashes survive)", () => {
    expect(routeSafeId("MITNT/42")).toBe("mitnt-42");
    expect(routeSafeId("ConFoo Montreal-2026-02-25")).toBe("confoo-montreal-2026-02-25");
  });

  it("is deterministic for the same input (stable across fetches)", () => {
    const a = routeSafeId("https://example.com/x/y");
    const b = routeSafeId("https://example.com/x/y");
    expect(a).toBe(b);
  });

  it("leaves already-safe ids readable", () => {
    expect(routeSafeId("aaai27")).toBe("aaai27");
    expect(routeSafeId("job_12345")).toBe("job_12345");
  });

  it("never returns an empty string", () => {
    expect(routeSafeId("///").length).toBeGreaterThan(0);
    expect(routeSafeId("").length).toBeGreaterThan(0);
  });
});

// B5-03 (round 5): a job board's own display name ("Climatebase" on
// climatebase.org) isn't a job-board *domain*, so a fixed denylist never
// catches it. Built once here so B5-06 can reuse it for an event title's
// site-brand segment instead of a second, duplicate check.
describe("looksLikeHostBrand", () => {
  it("rejects a candidate that equals the domain's own label", () => {
    expect(looksLikeHostBrand("Climatebase", "climatebase.org")).toBe(true);
  });

  it("rejects a candidate that is a prefix of a longer domain label", () => {
    expect(looksLikeHostBrand("ZeroB", "zerobonline.com")).toBe(true);
  });

  it("is case- and spacing-insensitive on both sides", () => {
    expect(looksLikeHostBrand("zero b", "ZeroBOnline.com")).toBe(true);
  });

  // The direction that must NOT reject: a real company's own display name
  // commonly shares a root with its own domain ("Acme Corp" at acme.test).
  // The domain label here is a prefix of a LONGER candidate, the opposite
  // shape from the two cases above — rejecting it would turn a real company
  // name into a lost one, which is worse than leaving the check narrower.
  it("keeps a real name that merely shares a root with a shorter domain label", () => {
    expect(looksLikeHostBrand("Acme Corp", "acme.test")).toBe(false);
    expect(looksLikeHostBrand("Acme Materials", "acme.test")).toBe(false);
  });

  it("ignores an unrelated candidate", () => {
    expect(looksLikeHostBrand("Northwind Labs", "acme.test")).toBe(false);
  });

  it("does not flag a short candidate (avoids over-matching on 1-2 letters)", () => {
    expect(looksLikeHostBrand("AI", "aiconf.org")).toBe(false);
  });
});
