import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canUseLocalServerProvider,
  hasUsableProviderOverride,
  resolveProvider,
} from "./registry";

const SERVER_AI_ENV = [
  "PEER_DIGEST_PROVIDER",
  "GOOGLE_VERTEX_PROJECT",
  "GOOGLE_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "QWEN_API_KEY",
  "DASHSCOPE_API_KEY",
  "DEEPSEEK_API_KEY",
  "VERCEL",
  "VERCEL_ENV",
] as const;

afterEach(() => {
  vi.unstubAllEnvs();
  for (const key of SERVER_AI_ENV) delete process.env[key];
});

describe("BYOK-only provider resolution", () => {
  it("ignores every server-owned provider credential in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("PEER_DIGEST_PROVIDER", "gemini");
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "operator-project");
    vi.stubEnv("GOOGLE_API_KEY", "operator-gemini-key");
    vi.stubEnv("ANTHROPIC_API_KEY", "operator-anthropic-key");
    vi.stubEnv("OPENAI_API_KEY", "operator-openai-key");
    vi.stubEnv("QWEN_API_KEY", "operator-qwen-key");
    vi.stubEnv("DEEPSEEK_API_KEY", "operator-deepseek-key");

    expect(canUseLocalServerProvider()).toBe(false);
    expect(resolveProvider()).toBeNull();
  });

  it("does not treat a Vercel preview as local development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "operator-project");

    expect(canUseLocalServerProvider()).toBe(false);
    expect(resolveProvider()).toBeNull();
  });

  it("keeps the existing local Vertex development path", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "local-project");

    expect(canUseLocalServerProvider()).toBe(true);
    expect(resolveProvider()?.id).toBe("gemini");
  });

  it("uses an explicit user key in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("GOOGLE_VERTEX_PROJECT", "operator-project");

    expect(
      resolveProvider({ provider: "openai", apiKey: " user-key " })?.id,
    ).toBe("openai");
  });

  it("rejects blank or unreasonably large user keys", () => {
    expect(
      hasUsableProviderOverride({ provider: "gemini", apiKey: "   " }),
    ).toBe(false);
    expect(
      hasUsableProviderOverride({
        provider: "gemini",
        apiKey: "x".repeat(4097),
      }),
    ).toBe(false);
  });
});
