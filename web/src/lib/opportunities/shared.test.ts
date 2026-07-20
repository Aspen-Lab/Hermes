import { describe, it, expect } from "vitest";
import { routeSafeId, urlHashId } from "./shared";

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
