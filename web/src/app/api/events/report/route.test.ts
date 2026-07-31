import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Event } from "@/types";

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

const event: Event = {
  id: "event:1",
  name: "Solid-State Battery Summit",
  type: "conference",
  date: "2026-09-10",
  location: "Chicago, IL",
  isOnline: false,
  shortDescription: "A research conference on solid-state batteries.",
  relevanceReason: "Matches solid-state battery research.",
  activities: ["Interface stability session"],
  organisations: [{ name: "Volta Lab", descriptor: "Exhibitor" }],
};

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/events/report", {
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

describe("POST /api/events/report", () => {
  it("returns a graceful Tier 0 response and makes no provider call when none resolves", async () => {
    mocks.resolveProvider.mockReturnValue(null);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await POST(request({ event, contextHint: "Topics: batteries" }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enrichment: null, noLlm: true });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(null);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses one large-tier call and returns parsed enrichment", async () => {
    const enrichment = {
      posterFit: {
        fits: true,
        reasoning: "The call overlaps with the declared interface work.",
      },
    };
    const generateJsonText = vi.fn().mockResolvedValue(JSON.stringify(enrichment));
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const llmOverride = { provider: "gemini", apiKey: "test-key" };

    const response = await POST(
      request({ event, contextHint: "Topics: batteries", llmOverride }),
    );

    expect(await response.json()).toEqual({ enrichment, noLlm: false });
    expect(mocks.resolveProvider).toHaveBeenCalledWith(llmOverride);
    expect(generateJsonText).toHaveBeenCalledTimes(1);
    expect(generateJsonText).toHaveBeenCalledWith(
      expect.objectContaining({ tier: "large", maxTokens: 1600 }),
    );
  });

  it("returns null enrichment when the provider output is unparseable", async () => {
    const generateJsonText = vi.fn().mockResolvedValue("not json");
    mocks.resolveProvider.mockReturnValue({ generateJsonText });

    const response = await POST(request({ event }));

    expect(await response.json()).toEqual({ enrichment: null, noLlm: false });
    expect(generateJsonText).toHaveBeenCalledTimes(1);
  });

  it("reopens the same cached report without a second provider call", async () => {
    const generateJsonText = vi.fn().mockResolvedValue(
      JSON.stringify({
        posterFit: { fits: true, reasoning: "The supplied scope overlaps." },
      }),
    );
    mocks.resolveProvider.mockReturnValue({ generateJsonText });
    const storage = new MemoryStorage();
    const load = () =>
      loadOpportunityEnrichment(
        "event:route-cache",
        async () => {
          const response = await POST(request({ event }));
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
