import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { meterProvider } from "./metered";
import { logLlmUsage } from "../usage-log";
import {
  setUsageEventsClientForTests,
  type UsageEventRow,
} from "@/lib/usage/events";
import type { DigestProvider, DigestResult } from "./types";

/**
 * ABC-freemium 1-04 — the tests for 1-03 (R-METER-1).
 *
 * The first case is the one that would otherwise ship a real outage: eleven
 * call sites decide whether to degrade by testing `provider?.generateJsonText`
 * / `generateVisionJsonText`, and DeepSeek deliberately has no vision method. A
 * wrapper that defined both unconditionally would turn "degrade cleanly" into
 * "call a method the provider cannot serve".
 */

const rows: UsageEventRow[] = [];

/** Let the fire-and-forget insert land before asserting on it. */
async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

beforeEach(() => {
  rows.length = 0;
  setUsageEventsClientForTests({
    from: () => ({
      insert: (inserted: UsageEventRow[]) => {
        rows.push(...inserted);
        return Promise.resolve({ error: null });
      },
    }),
  } as never);
});

afterEach(() => {
  setUsageEventsClientForTests(undefined);
  vi.restoreAllMocks();
});

function baseProvider(
  overrides: Partial<DigestProvider> = {},
): DigestProvider {
  return {
    id: "deepseek",
    generateDigest: () => Promise.resolve({ bullets: [] } as DigestResult),
    testConnection: () => Promise.resolve({ ok: true }),
    ...overrides,
  };
}

describe("meterProvider", () => {
  it("copies method presence rather than assuming it", () => {
    // The DeepSeek case: no generateVisionJsonText before, none after.
    const wrapped = meterProvider(
      baseProvider({ generateJsonText: () => Promise.resolve("{}") }),
      { userId: "u1", byok: false },
    );

    expect(typeof wrapped.generateJsonText).toBe("function");
    expect(wrapped.generateVisionJsonText).toBeUndefined();
    expect("generateVisionJsonText" in wrapped).toBe(false);
  });

  it("preserves the provider id", () => {
    const wrapped = meterProvider(baseProvider({ id: "gemini" }), {
      userId: null,
      byok: false,
    });

    expect(wrapped.id).toBe("gemini");
  });

  it("records one row per call, with the tokens the provider reported", async () => {
    const wrapped = meterProvider(
      baseProvider({
        id: "gemini",
        generateJsonText: () => {
          logLlmUsage({
            provider: "gemini",
            model: "gemini-flash",
            path: "report:pass2",
            inputTokens: 120,
            outputTokens: 45,
            thinkingTokens: 12,
            latencyMs: 987,
            ok: true,
          });
          return Promise.resolve("{}");
        },
      }),
      { userId: "user-9", byok: false },
    );

    await wrapped.generateJsonText?.({
      systemPrompt: "s",
      userPrompt: "u",
    });
    await flush();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: "user-9",
      kind: "llm",
      path: "report:pass2",
      provider: "gemini",
      model: "gemini-flash",
      input_tokens: 120,
      output_tokens: 45,
      thinking_tokens: 12,
      latency_ms: 987,
      ok: true,
      byok: false,
    });
  });

  it("attributes a BYOK call to the user's own key", async () => {
    const wrapped = meterProvider(
      baseProvider({
        generateJsonText: () => {
          logLlmUsage({
            provider: "deepseek",
            model: "deepseek-chat",
            latencyMs: 10,
            ok: true,
          });
          return Promise.resolve("{}");
        },
      }),
      { userId: "user-9", byok: true },
    );

    await wrapped.generateJsonText?.({ systemPrompt: "s", userPrompt: "u" });
    await flush();

    expect(rows[0].byok).toBe(true);
  });

  it("re-throws, and records ok:false when nothing else logged", async () => {
    // The throw-before-any-logging case: a provider that cannot build its
    // client. Every existing catch/degrade path depends on the re-throw.
    const wrapped = meterProvider(
      baseProvider({
        generateJsonText: () =>
          Promise.reject(new Error("GOOGLE_VERTEX_PROJECT not set")),
      }),
      { userId: "user-9", byok: false, path: "digest" },
    );

    await expect(
      wrapped.generateJsonText?.({ systemPrompt: "s", userPrompt: "u" }),
    ).rejects.toThrow("GOOGLE_VERTEX_PROJECT not set");
    await flush();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "llm", ok: false, path: "digest" });
  });

  it("does not write a second row when the provider already logged the failure", async () => {
    // Every provider calls logLlmUsage on its error path as well as its success
    // path, so the wrapper must not double-count. R-METER-1 asks for one row.
    const wrapped = meterProvider(
      baseProvider({
        generateJsonText: () => {
          logLlmUsage({
            provider: "openai",
            model: "gpt",
            latencyMs: 5,
            ok: false,
          });
          return Promise.reject(new Error("upstream 500"));
        },
      }),
      { userId: "user-9", byok: false },
    );

    await expect(
      wrapped.generateJsonText?.({ systemPrompt: "s", userPrompt: "u" }),
    ).rejects.toThrow("upstream 500");
    await flush();

    expect(rows).toHaveLength(1);
    expect(rows[0].ok).toBe(false);
  });

  it("never records a key-shaped field", async () => {
    // A usage table is exactly where a leaked credential would survive longest.
    const wrapped = meterProvider(
      baseProvider({
        generateJsonText: () => {
          logLlmUsage({
            provider: "gemini",
            model: "gemini-flash",
            latencyMs: 1,
            ok: true,
          });
          return Promise.resolve("{}");
        },
      }),
      { userId: "user-9", byok: false },
    );

    await wrapped.generateJsonText?.({ systemPrompt: "s", userPrompt: "u" });
    await flush();

    const keyish = Object.keys(rows[0]).filter((name) => /key|secret/i.test(name));
    expect(keyish).toEqual([]);
  });

  it("attributes concurrent calls separately", async () => {
    // The reason the context is an AsyncLocalStorage rather than a module
    // variable: two feed loads running at once must not attribute each other's
    // spend.
    const provider = baseProvider({
      generateJsonText: async (args) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        logLlmUsage({
          provider: "gemini",
          model: "gemini-flash",
          path: args.userPrompt,
          latencyMs: 1,
          ok: true,
        });
        return "{}";
      },
    });

    await Promise.all([
      meterProvider(provider, { userId: "user-a", byok: false }).generateJsonText?.(
        { systemPrompt: "s", userPrompt: "a" },
      ),
      meterProvider(provider, { userId: "user-b", byok: true }).generateJsonText?.(
        { systemPrompt: "s", userPrompt: "b" },
      ),
    ]);
    await flush();

    const byPath = Object.fromEntries(rows.map((row) => [row.path, row]));
    expect(byPath.a.user_id).toBe("user-a");
    expect(byPath.a.byok).toBe(false);
    expect(byPath.b.user_id).toBe("user-b");
    expect(byPath.b.byok).toBe(true);
  });
});
