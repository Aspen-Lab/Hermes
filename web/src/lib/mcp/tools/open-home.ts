import { getDailyForecast, MAX_LIMIT } from "./get-daily-forecast";
import type { DailyForecastResult, ForecastItemType } from "../types";

export interface OpenHomeInput {
  type?: ForecastItemType;
}

/**
 * Parameter-shaping wrapper around `getDailyForecast` for the fullscreen
 * Daily Forecast home -- no new business logic. "Open my Peer home" means
 * the full view, not the inline card's ~9-item default, so this always
 * requests the existing `MAX_LIMIT` ceiling rather than exposing a
 * model-facing `limit` parameter (docs/handoff/MULTIAGENT-mcp-app.md §4
 * "Round 3 -- Agent B", "Contract to build to").
 */
export async function openHome(
  userId: string,
  input: OpenHomeInput = {},
): Promise<DailyForecastResult> {
  return getDailyForecast(userId, { type: input.type, limit: MAX_LIMIT });
}
