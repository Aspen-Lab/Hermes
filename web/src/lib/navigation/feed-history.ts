const FEED_HISTORY_ENTRY_KEY = "peer-feed-history-entry-v1";

interface FeedHistorySource {
  history: Pick<History, "length">;
  location: Pick<Location, "pathname" | "search" | "hash">;
  navigation?: {
    currentEntry?: { index: number } | null;
  };
  sessionStorage: Pick<Storage, "getItem" | "setItem">;
}

interface FeedHistoryEntry {
  path: string;
  position: number;
}

function currentHistoryPosition(source: FeedHistorySource): number {
  const navigationIndex = source.navigation?.currentEntry?.index;
  if (Number.isInteger(navigationIndex) && navigationIndex! >= 0) {
    return navigationIndex!;
  }

  return Math.max(0, source.history.length - 1);
}

export function rememberFeedHistoryEntry(source: FeedHistorySource): void {
  const entry: FeedHistoryEntry = {
    path: `${source.location.pathname}${source.location.search}${source.location.hash}`,
    position: currentHistoryPosition(source),
  };

  try {
    source.sessionStorage.setItem(FEED_HISTORY_ENTRY_KEY, JSON.stringify(entry));
  } catch {
    // A blocked storage API should degrade to the link's real href.
  }
}

export function hasImmediateFeedHistoryEntry(source: FeedHistorySource): boolean {
  try {
    const raw = source.sessionStorage.getItem(FEED_HISTORY_ENTRY_KEY);
    if (!raw) return false;

    const entry = JSON.parse(raw) as Partial<FeedHistoryEntry>;
    return (
      entry.path?.startsWith("/") === true &&
      Number.isInteger(entry.position) &&
      currentHistoryPosition(source) === entry.position! + 1
    );
  } catch {
    return false;
  }
}
