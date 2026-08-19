import { describe, expect, it } from "vitest";
import {
  hasImmediateFeedHistoryEntry,
  rememberFeedHistoryEntry,
} from "./feed-history";

function browserState(position: number) {
  const storage = new Map<string, string>();
  return {
    source: {
      history: { length: position + 1 },
      location: { pathname: "/", search: "?tab=jobs", hash: "" },
      navigation: { currentEntry: { index: position } },
      sessionStorage: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, value),
      },
    },
  };
}

describe("feed history", () => {
  it("recognises the feed as the immediately preceding entry", () => {
    const { source } = browserState(4);
    rememberFeedHistoryEntry(source);
    source.navigation.currentEntry.index = 5;

    expect(hasImmediateFeedHistoryEntry(source)).toBe(true);
  });

  it("uses the href fallback when no feed entry precedes the report", () => {
    const { source } = browserState(4);

    expect(hasImmediateFeedHistoryEntry(source)).toBe(false);
  });
});
