import { describe, expect, it, vi } from "vitest";
import type { CachedJobPool } from "./pool-cache";
import {
  SupabasePoolCache,
  type OpportunityPoolSupabaseClient,
} from "./pool-cache-supabase";

const key =
  "peer-pool-v1-jobs-2026-07-27-fedcba9876543210fedcba9876543210";

const pool: CachedJobPool = {
  surface: "jobs",
  generatedAt: "2026-07-27T12:00:00.000Z",
  localDate: "2026-07-27",
  items: [],
  facetCounts: {
    location: {},
    month: {},
    format: { "in-person": 0, online: 0, hybrid: 0 },
  },
};

function fakeClient(result: {
  data: { payload: unknown } | null;
  error: unknown;
}) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ select, upsert }));
  return {
    client: { from } as OpportunityPoolSupabaseClient,
    from,
    select,
    eq,
    maybeSingle,
    upsert,
  };
}

describe("SupabasePoolCache", () => {
  it("is a clean no-op when Supabase is unconfigured", async () => {
    const cache = new SupabasePoolCache({ client: null });

    await expect(cache.get(key)).resolves.toBeNull();
    await expect(cache.set(key, pool)).resolves.toBeUndefined();
  });

  it("reads a valid cached payload and treats errors as misses", async () => {
    const success = fakeClient({ data: { payload: pool }, error: null });
    const cache = new SupabasePoolCache({ client: success.client });

    await expect(cache.get(key)).resolves.toEqual(pool);
    expect(success.from).toHaveBeenCalledWith("opportunity_pools");
    expect(success.select).toHaveBeenCalledWith("payload");
    expect(success.eq).toHaveBeenCalledWith("key", key);

    const failure = fakeClient({ data: null, error: new Error("offline") });
    await expect(
      new SupabasePoolCache({ client: failure.client }).get(key),
    ).resolves.toBeNull();
  });

  it("upserts by key and never throws on client failure", async () => {
    const fake = fakeClient({ data: null, error: null });
    const cache = new SupabasePoolCache({ client: fake.client });

    await cache.set(key, pool);

    expect(fake.upsert).toHaveBeenCalledOnce();
    expect(fake.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ key, payload: pool }),
      { onConflict: "key" },
    );

    fake.upsert.mockRejectedValueOnce(new Error("offline"));
    await expect(cache.set(key, pool)).resolves.toBeUndefined();
  });
});
