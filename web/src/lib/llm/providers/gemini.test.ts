import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The SDK is stood in for so the model chain can be driven without a key or a
// network. Everything else — the chain loop, the logging and the `ok`
// computation — stays real, because that is the subject.
const generateContentMock = vi.hoisted(() => vi.fn());
vi.mock("@google/genai", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@google/genai")>()),
  GoogleGenAI: class {
    models = { generateContent: generateContentMock };
  },
}));

import { createGeminiApiProvider } from "./gemini";
import {
  setUsageEventsClientForTests,
  type UsageEventRow,
} from "@/lib/usage/events";

/**
 * ABC-freemium 2-05 · R-METER-1 (amended 2026-09-05) · Ruling 6 point 5.
 *
 * **`ok` says whether the request produced usable output.** Every success path
 * in this module used to pass a literal `true`, so a model that answered with
 * empty text wrote an `ok: true` row and the chain then fell through to the
 * next model — the ledger recorded a success the caller never received. There
 * was no suite on this file at all before this item.
 */
describe("2-05 — a Gemini request's `ok` reflects what it returned", () => {
  const rows: UsageEventRow[] = [];

  beforeEach(() => {
    rows.length = 0;
    generateContentMock.mockReset();
    setUsageEventsClientForTests({
      from: () => ({
        insert: (inserted: UsageEventRow[]) => {
          rows.push(...inserted);
          return Promise.resolve({ error: null });
        },
      }),
    } as never);
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    setUsageEventsClientForTests(undefined);
    vi.restoreAllMocks();
  });

  /** Let the fire-and-forget inserts land before asserting on them. */
  async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it("writes ok:false for a request that returned EMPTY text", async () => {
    // The one-word defect. The request succeeded at the HTTP level and produced
    // nothing usable; the chain moves on, and the row must say so.
    generateContentMock.mockResolvedValue({ text: "   " });
    const provider = createGeminiApiProvider("GOOGLE-NOT-A-KEY");

    await expect(
      provider.generateJsonText!({
        systemPrompt: "s",
        userPrompt: "u",
        maxTokens: 10,
      }),
    ).rejects.toThrow();
    await flush();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.ok === false)).toBe(true);
  });

  it("writes ok:true for a request that returned real text", async () => {
    // The other half, so the case above is not passing by making everything
    // false.
    generateContentMock.mockResolvedValue({ text: '{"a":1}' });
    const provider = createGeminiApiProvider("GOOGLE-NOT-A-KEY");

    await provider.generateJsonText!({
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 10,
    });
    await flush();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "llm", provider: "gemini", ok: true });
  });

  it("writes ONE ROW PER REQUEST across a fallback chain, not one per call", async () => {
    // Ruling 6 point 5's billing reading, asserted on the real chain loop: the
    // first model answers empty, the second answers properly, and the owner's
    // ledger shows both requests because both were billed.
    generateContentMock
      .mockResolvedValueOnce({ text: "" })
      .mockResolvedValue({ text: '{"a":1}' });
    const provider = createGeminiApiProvider("GOOGLE-NOT-A-KEY");

    await provider.generateJsonText!({
      systemPrompt: "s",
      userPrompt: "u",
      maxTokens: 10,
    });
    await flush();

    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.ok)).toEqual([false, true]);
    // Different models, so a reader can see which attempt cost what.
    expect(new Set(rows.map((r) => r.model)).size).toBe(2);
  });

  it("writes ok:false when the request throws", async () => {
    // Unchanged behaviour, pinned beside the new one.
    generateContentMock.mockRejectedValue(new Error("boom"));
    const provider = createGeminiApiProvider("GOOGLE-NOT-A-KEY");

    await expect(
      provider.generateJsonText!({
        systemPrompt: "s",
        userPrompt: "u",
        maxTokens: 10,
      }),
    ).rejects.toThrow();
    await flush();

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.ok === false)).toBe(true);
  });
});
