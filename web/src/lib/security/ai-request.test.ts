import { afterEach, describe, expect, it, vi } from "vitest";
import { protectAiRequest } from "./ai-request";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("protectAiRequest", () => {
  it("keeps local next dev available without cloud auth", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    await expect(protectAiRequest("test")).resolves.toBeNull();
  });

  it("fails closed when a deployment has no auth configuration", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    const response = await protectAiRequest("test");
    expect(response?.status).toBe(503);
  });
});
