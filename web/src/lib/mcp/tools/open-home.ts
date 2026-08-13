import { createAdminClient } from "@/lib/supabase/admin";
import { profileRowToProfile } from "@/app/api/profile/route";
import { getDailyForecast, MAX_LIMIT } from "./get-daily-forecast";
import type { DailyForecastResult, ForecastItemType } from "../types";

export interface OpenHomeInput {
  type?: ForecastItemType;
}

/**
 * A second, tiny profile lookup for the display name only -- matches
 * get-opportunity.ts's own `resolveProfileForPipelines` precedent rather
 * than inventing a new one. `getDailyForecast` already resolves the
 * profile row internally but doesn't return it, and `personaName` is
 * needed only here (the inline card doesn't show it), so the lowest-blast-
 * radius option is this small, separate lookup rather than changing
 * getDailyForecast's return type.
 */
async function resolveDisplayName(userId: string): Promise<string | undefined> {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return undefined;
  const profile = profileRowToProfile(row as Parameters<typeof profileRowToProfile>[0]);
  return profile.displayName;
}

/**
 * Parameter-shaping wrapper around `getDailyForecast` for the fullscreen
 * Daily Forecast home -- no new business logic beyond the display-name
 * attachment above. "Open my Peer home" means the full view, not the
 * inline card's ~9-item default, so this always requests the existing
 * `MAX_LIMIT` ceiling rather than exposing a model-facing `limit`
 * parameter (docs/handoff/MULTIAGENT-mcp-app.md §4 "Round 3 -- Agent B",
 * "Contract to build to").
 */
export async function openHome(
  userId: string,
  input: OpenHomeInput = {},
): Promise<DailyForecastResult> {
  const [result, displayName] = await Promise.all([
    getDailyForecast(userId, { type: input.type, limit: MAX_LIMIT }),
    resolveDisplayName(userId),
  ]);
  return displayName ? { ...result, personaName: displayName } : result;
}
