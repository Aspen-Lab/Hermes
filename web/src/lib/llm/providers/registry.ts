import type {
  DigestProvider,
  ProviderId,
  ProviderOverrideConfig,
} from "./types";
import { anthropicProvider, createAnthropicProvider } from "./anthropic";
import { geminiProvider, createGeminiApiProvider } from "./gemini";
import { openaiProvider, createOpenAIProvider } from "./openai";
import { qwenProvider, createQwenProvider } from "./qwen";

const providers: Record<ProviderId, DigestProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  openai: openaiProvider,
  qwen: qwenProvider,
  ollama: geminiProvider, // placeholder until an Ollama provider exists
};

/**
 * Resolves the active provider from either a per-request override or env vars.
 * Resolution order:
 *   1. Explicit per-request override
 *   2. HERMES_DIGEST_PROVIDER env var
 *   3. First configured server-side provider
 *   4. null (no LLM - Tier 0 fallback)
 */
export function resolveProvider(
  override?: ProviderOverrideConfig | null,
): DigestProvider | null {
  if (override?.provider && override.apiKey?.trim()) {
    const apiKey = override.apiKey.trim();
    switch (override.provider) {
      case "anthropic":
        return createAnthropicProvider(apiKey, override.model);
      case "gemini":
        return createGeminiApiProvider(apiKey);
      case "openai":
        return createOpenAIProvider(apiKey, override.model);
      case "qwen":
        return createQwenProvider(apiKey, override.model);
      default:
        break;
    }
  }

  const explicit = process.env.HERMES_DIGEST_PROVIDER as ProviderId | undefined;
  if (explicit && explicit in providers) {
    return providers[explicit];
  }

  if (process.env.GOOGLE_VERTEX_PROJECT) return geminiProvider;
  if (process.env.GOOGLE_API_KEY) {
    return createGeminiApiProvider(process.env.GOOGLE_API_KEY);
  }
  if (process.env.ANTHROPIC_API_KEY) return anthropicProvider;
  if (process.env.OPENAI_API_KEY) return openaiProvider;
  if (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY) return qwenProvider;
  return null;
}
