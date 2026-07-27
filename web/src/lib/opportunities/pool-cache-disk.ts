import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import type { CachedPool, PoolCache } from "./pool-cache";

const SAFE_CACHE_KEY = /^[a-z0-9][a-z0-9-]{0,199}$/;

export interface DiskPoolCacheOptions {
  directory?: string;
  enabled?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCachedPool(value: unknown): value is CachedPool {
  if (!isRecord(value)) return false;
  if (value.surface !== "events" && value.surface !== "jobs") return false;
  if (!Array.isArray(value.items)) return false;
  if (typeof value.generatedAt !== "string") return false;
  if (typeof value.localDate !== "string") return false;
  return isRecord(value.facetCounts);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export class DiskPoolCache implements PoolCache {
  private readonly directory: string;
  private readonly enabled: boolean;

  constructor(options: DiskPoolCacheOptions = {}) {
    this.directory =
      options.directory ??
      path.join(process.cwd(), ".local-data", "pool-cache");
    this.enabled =
      options.enabled ?? process.env.NODE_ENV === "development";
  }

  private filePath(key: string): string | null {
    if (!SAFE_CACHE_KEY.test(key)) return null;
    return path.join(this.directory, `${key}.json`);
  }

  async get(key: string): Promise<CachedPool | null> {
    if (!this.enabled) return null;
    const filePath = this.filePath(key);
    if (!filePath) return null;

    try {
      const parsed: unknown = JSON.parse(await readFile(filePath, "utf8"));
      return isCachedPool(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }

  async set(key: string, pool: CachedPool): Promise<void> {
    if (!this.enabled) return;
    const filePath = this.filePath(key);
    if (!filePath) return;

    const tempPath = path.join(
      this.directory,
      `.${key}.${process.pid}.${randomUUID()}.tmp`,
    );
    try {
      await mkdir(this.directory, { recursive: true });
      await writeFile(tempPath, JSON.stringify(pool), "utf8");
      try {
        await rename(tempPath, filePath);
      } catch (error) {
        // Windows does not replace an existing destination atomically. The
        // first complete writer for a daily key wins; later equivalent builds
        // can safely discard their temporary file.
        if (!(await fileExists(filePath))) throw error;
        await rm(tempPath, { force: true });
      }
    } catch {
      await rm(tempPath, { force: true }).catch(() => undefined);
    }
  }
}
