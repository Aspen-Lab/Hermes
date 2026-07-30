import { DiskPoolCache } from "./pool-cache-disk";
import { SupabasePoolCache } from "./pool-cache-supabase";
import type { PoolCache } from "./pool-cache";

let defaultPoolCache: PoolCache | undefined;

/**
 * Local development persists pools on disk. Deployed/server builds use the
 * shared Supabase table; when it is unconfigured that adapter is a clean miss.
 */
export function getDefaultOpportunityPoolCache(): PoolCache {
  if (!defaultPoolCache) {
    defaultPoolCache =
      process.env.NODE_ENV === "development"
        ? new DiskPoolCache()
        : new SupabasePoolCache();
  }
  return defaultPoolCache;
}
