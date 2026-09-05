/**
 * The daily cap on operator-funded search.
 *
 * ABC-freemium 1-21 · R-QUOTA-2, D4.
 *
 * **Two callers, one home.** The ordinary search fan-out in `jobweb`/`eventweb`
 * consumes it, and so does 1-18's forced pool rebuild. Writing the rule twice is
 * how the two would end up disagreeing about the limit.
 *
 * **Fails closed**, like every breaker: an unreadable counter is treated as
 * tripped. A wallet that cannot be read must not be spent, and the cost is
 * bounded — the surface serves its free structured sources, which is what a
 * keyless reader already gets.
 *
 * **"For the rest of the UTC day" is a property of the key, not extra state.**
 * The key carries the UTC date, so a tripped breaker untrips itself at midnight.
 * Do **not** add a `trippedUntil` timestamp: it would be a second source of
 * truth for the same fact.
 */
import {
  SYSTEM_SEARCHES_PER_DAY,
  breakerTripped,
  endOfUtcDay,
  getCounterStore,
  systemSearchDayKey,
} from "./counters";
import { recordUsageEventAwaited } from "./events";

export { SYSTEM_SEARCHES_PER_DAY };

/**
 * Charge `count` system searches to `userId` and say whether they may run.
 *
 * Returns `true` when there is no user to charge **only** because such a call
 * cannot reach the operator's key in the first place — `systemSearchAllowed`
 * comes from an entitlement, and an entitlement with no user never allows it.
 * The caller has already made that decision before arriving here.
 */
export async function consumeSystemSearches(
  userId: string | null,
  count: number,
  now: Date = new Date(),
  surface?: string,
): Promise<boolean> {
  if (!userId || count <= 0) return true;

  const reading = await getCounterStore().increment(
    systemSearchDayKey(userId, now),
    endOfUtcDay(now),
    count,
    // One clock (2-01): the same `now` that built the key drives the store's
    // housekeeping sweep, so a caller who pins time keeps its own entries.
    now,
  );
  if (!breakerTripped(reading, SYSTEM_SEARCHES_PER_DAY)) return true;

  // D4 names three things a trip does: an error-level line, a `breaker` usage
  // row, and degradation for the rest of the UTC day.
  console.error(
    `[quota] system-search breaker tripped for ${userId} (limit ${SYSTEM_SEARCHES_PER_DAY}/day)`,
  );
  // Awaited: this is the audit trail for a spend cap that has already been
  // decided by the counter. Losing it to a cold shutdown would leave a trip
  // with no record.
  await recordUsageEventAwaited({
    user_id: userId,
    kind: "breaker",
    path: "system-search",
    surface: surface ?? null,
    query_count: count,
    ok: false,
    byok: false,
  });
  return false;
}
