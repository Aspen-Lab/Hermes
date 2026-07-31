import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  resolveProvider: vi.fn(),
  runFeedPipeline: vi.fn(),
}));

vi.mock("@/lib/llm/providers/registry", () => ({
  resolveProvider: mocks.resolveProvider,
}));
vi.mock("@/lib/feed/pipeline", () => ({
  runFeedPipeline: mocks.runFeedPipeline,
}));

import { POST } from "./route";

function request(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost/api/feed", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runFeedPipeline.mockResolvedValue({ items: [], meta: {} });
});

describe("POST /api/feed AI tier gate", () => {
  it("downgrades a forged Tier 2 request to Tier 0 without a provider", async () => {
    mocks.resolveProvider.mockReturnValue(null);

    await POST(request({ topics: ["battery"], aiTier: 2 }));

    expect(mocks.runFeedPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ aiTier: 0, llmOverride: undefined }),
    );
  });

  it("keeps Tier 2 when a user override resolves", async () => {
    mocks.resolveProvider.mockReturnValue({ id: "openai", generateJsonText: vi.fn() });
    const llmOverride = { provider: "openai", apiKey: "user-owned-key" };

    await POST(request({ topics: ["battery"], aiTier: 2, llmOverride }));

    expect(mocks.resolveProvider).toHaveBeenCalledWith(llmOverride);
    expect(mocks.runFeedPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ aiTier: 2, llmOverride }),
    );
  });
});
