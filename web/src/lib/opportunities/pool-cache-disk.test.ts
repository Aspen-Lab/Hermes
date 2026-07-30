import path from "node:path";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import type { CachedEventPool } from "./pool-cache";
import { DiskPoolCache } from "./pool-cache-disk";

const key =
  "peer-pool-v1-events-2026-07-27-0123456789abcdef0123456789abcdef";

const pool: CachedEventPool = {
  surface: "events",
  generatedAt: "2026-07-27T12:00:00.000Z",
  localDate: "2026-07-27",
  items: [
    {
      id: "eventweb:1",
      source: "eventweb",
      name: "Solid-State Battery Summit",
      type: "conference",
      startDate: "2026-08-11",
      location: "Chicago, IL",
      place: { city: "Chicago", region: "IL" },
      isOnline: true,
      description: "Battery materials conference",
      url: "https://example.com/event",
      tags: ["solid-state battery"],
      score: 0.8,
      matchedKeywords: ["solid-state battery"],
      relevanceReason: "Matches solid-state battery",
    },
  ],
  facetCounts: {
    location: { Chicago: 1 },
    month: { "2026-08": 1 },
    format: { "in-person": 0, online: 0, hybrid: 1 },
  },
};

const tempDirectories: string[] = [];

async function tempDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "peer-pool-cache-"));
  tempDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    tempDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("DiskPoolCache", () => {
  it("round-trips a complete pool through the development cache", async () => {
    const directory = await tempDirectory();
    const cache = new DiskPoolCache({ directory, enabled: true });

    await cache.set(key, pool);

    await expect(cache.get(key)).resolves.toEqual(pool);
    const persisted = await readFile(path.join(directory, `${key}.json`), "utf8");
    expect(JSON.parse(persisted)).toEqual(pool);
  });

  it("treats missing, malformed, and unsafe keys as cache misses", async () => {
    const directory = await tempDirectory();
    const cache = new DiskPoolCache({ directory, enabled: true });

    await expect(cache.get(key)).resolves.toBeNull();
    await writeFile(path.join(directory, `${key}.json`), "{broken", "utf8");
    await expect(cache.get(key)).resolves.toBeNull();
    await cache.set("../escape", pool);
    await expect(cache.get("../escape")).resolves.toBeNull();
  });

  it("does no filesystem work when development caching is disabled", async () => {
    const directory = path.join(await tempDirectory(), "disabled");
    const cache = new DiskPoolCache({ directory, enabled: false });

    await cache.set(key, pool);

    await expect(cache.get(key)).resolves.toBeNull();
    await expect(readFile(path.join(directory, `${key}.json`), "utf8")).rejects.toThrow();
  });
});
