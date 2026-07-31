import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/jobs/dispatch-digests", () => {
  it("rejects a forged Vercel cron header without the shared secret", async () => {
    vi.stubEnv("CRON_SECRET", "real-secret");
    const request = new NextRequest(
      "http://localhost/api/jobs/dispatch-digests",
      { headers: { "x-vercel-cron": "1" } },
    );

    const response = await GET(request);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
  });
});
