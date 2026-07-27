import { createAdminClient } from "@/lib/supabase/admin";
import {
  isCachedPool,
  type CachedPool,
  type PoolCache,
} from "./pool-cache";

interface SupabaseResult<T> {
  data: T | null;
  error: unknown;
}

interface SupabaseSingleQuery {
  maybeSingle(): Promise<SupabaseResult<{ payload: unknown }>>;
}

interface SupabaseFilterQuery {
  eq(column: string, value: string): SupabaseSingleQuery;
}

export interface OpportunityPoolSupabaseClient {
  from(table: string): {
    select(columns: string): SupabaseFilterQuery;
    upsert(
      row: { key: string; payload: CachedPool; created_at: string },
      options: { onConflict: string },
    ): Promise<{ error: unknown }>;
  };
}

export interface SupabasePoolCacheOptions {
  client?: OpportunityPoolSupabaseClient | null;
}

function configuredAdminClient(): OpportunityPoolSupabaseClient | null {
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.SUPABASE_SERVICE_ROLE_KEY
  ) {
    return null;
  }
  try {
    return createAdminClient() as unknown as OpportunityPoolSupabaseClient;
  } catch {
    return null;
  }
}

export class SupabasePoolCache implements PoolCache {
  private readonly client: OpportunityPoolSupabaseClient | null;

  constructor(options: SupabasePoolCacheOptions = {}) {
    this.client =
      options.client === undefined ? configuredAdminClient() : options.client;
  }

  async get(key: string): Promise<CachedPool | null> {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from("opportunity_pools")
        .select("payload")
        .eq("key", key)
        .maybeSingle();
      if (error || !isCachedPool(data?.payload)) return null;
      return data.payload;
    } catch {
      return null;
    }
  }

  async set(key: string, pool: CachedPool): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.from("opportunity_pools").upsert(
        {
          key,
          payload: pool,
          created_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      );
    } catch {
      // Cache persistence must never block the daily Tier-0 pipeline.
    }
  }
}
