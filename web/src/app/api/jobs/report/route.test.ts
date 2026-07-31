import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Job } from "@/types";

const mocks = vi.hoisted(() => ({
  resolveProvider: vi.fn(),
}));

vi.mock("@/lib/llm/providers/registry", () => ({
  resolveProvider: mocks.resolveProvider,
}));

import { POST } from "./route";
import { loadOpportunityEnrichment } from "@/lib/opportunities/enrichment";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

const job: Job = {
  id: "job:1",
  roleTitle: "Battery Research Scientist",
  companyOrLab: "Volta Lab",
  location: "Chicago, IL",
  isRemote: false,
  keyRequirements: ["Electrochemistry", "PhD"],
  matchReason: "Matches solid-state battery research.",
  visa: { state: "not-stated", country: "United States" },
};

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/jobs/report", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/jobs/report", () => {
  it("returns a graceful Tier 0 response and makes no provider call when none resolves", async () => {
    mocks.resolveProvider.mockReturnValue(null);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(request({ job, contextHint: "Topics: batteries" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enrichment: null, noLlm: true });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(null);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses one large-tier call and returns parsed enrichment", async () => {
    const enrichment = {
      competitiveness: {
        verdict: "Strong match",
        reasoning: "The declared methods match the posting.",
      },
    };
    const generateJsonText = vi.fn().mockResolvedValue(JSON.stringify(enrichment));
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const llmOverride = { provider: "gemini", apiKey: "test-key" };

    const response = await POST(
      request({ job, contextHint: "Topics: batteries", llmOverride }),
    );

    expect(await response.json()).toEqual({ enrichment, noLlm: false });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(llmOverride);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
    expect(generateJsonText).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "large", maxTokens: 1200 }),
    );
  });

  it("returns null enrichment when the provider output is unparseable", async () => {
    const generateJsonText = vi.fn().mockResolvedValue("not json");
    mocks.resolveProvider.mockReturnValue({ generateJsonText });

    const response = await POST(request({ job }));

    expect(await response.json()).toEqual({ enrichment: null, noLlm: false });
    expect(generateJsonText).toHaveBeenCalledTimes(1);
  });

  it("reopens the same cached report without a second provider call", async () => {
    const generateJsonText = vi.fn().mockResolvedValue(
      JSON.stringify({
        competitiveness: { verdict: "Strong", reasoning: "Methods align." },
      }),
    );
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const storage = new MemoryStorage();
    const load = () =>
      loadOpportunityEnrichment(
        "job:route-cache",
        async () => {
          const response = await POST(request({ job }));
          const result = (await response.json()) as { enrichment: unknown | null };
          return result.enrichment;
        },
        Date.UTC(2026, 6, 31),
        storage,
      );

    await load();
    await load();

    expect(generateJsonText).toHaveBeenCalledTimes(1);
  });
});
