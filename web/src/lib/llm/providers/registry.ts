import type {
  DigestProvider,
  ProviderId,
  ProviderOverrideConfig,
} from "./types";
import { anthropicProvider, createAnthropicProvider } from "./anthropic";
import { geminiProvider, createGeminiApiProvider } from "./gemini";
import { openaiProvider, createOpenAIProvider } from "./openai";
import { qwenProvider, createQwenProvider } from "./qwen";
import { deepseekProvider, createDeepseekProvider } from "./deepseek";
import { isLocalDevRuntime } from "@/lib/env/local-dev";
import { meterProvider } from "./metered";

const providers: Record<ProviderId, DigestProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  openai: openaiProvider,
  qwen: qwenProvider,
  deepseek: deepseekProvider,
  ollama: geminiProvider, // placeholder until an Ollama provider exists
};

const USER_PROVIDER_IDS = new Set<ProviderOverrideConfig["provider"]>([
  "anthropic",
  "gemini",
  "openai",
  "qwen",
  "deepseek",
]);

/**
 * Server-owned model credentials are a local-development convenience only.
 * Preview, production, tests, and `vercel dev` must all fail closed so a
 * deployed Peer instance can never spend the operator's model account.
 *
 * ABC-freemium 1-01 — the three-condition body moved to `lib/env/local-dev.ts`
 * so entitlement resolution, the AI-request guard and this all read one
 * predicate. The exported name and its meaning are unchanged.
 */
export function canUseLocalServerProvider(): boolean {
  return isLocalDevRuntime();
}

export function hasUsableProviderOverride(
  override: ProviderOverrideConfig | null | undefined,
): override is ProviderOverrideConfig {
  return Boolean(
    override &&
      USER_PROVIDER_IDS.has(override.provider) &&
      override.apiKey?.trim() &&
      override.apiKey.trim().length <= 4096 &&
      (!override.model || override.model.trim().length <= 160),
  );
}

function resolveUserProvider(
  override: ProviderOverrideConfig,
): DigestProvider | null {
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
    case "deepseek":
      return createDeepseekProvider(apiKey, override.model);
    default:
      return null;
  }
}

function resolveLocalServerProvider(): DigestProvider | null {
  const explicit = process.env.PEER_DIGEST_PROVIDER as ProviderId | undefined;
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
  if (process.env.DEEPSEEK_API_KEY) return deepseekProvider;
  return null;
}

/**
 * Resolve a provider without ever giving deployed users an operator-funded
 * fallback.
 *
 * Resolution order:
 *   1. Valid per-request BYOK override supplied by the current user.
 *   2. Local `next dev` server credentials (developer convenience only).
 *   3. null (Tier 0 fallback everywhere else).
 *
 * ABC-freemium 1-03 · R-METER-1 — the result is wrapped by `meterProvider` at
 * this single return point, so all thirteen acquisition sites are metered
 * without a user id threaded through any of them. **The second argument is
 * optional and stays optional**: making it required would be a thirteen-site
 * edit and a call site that omits it still meters, with a null `user_id`, which
 * is the honest value for a library-level call inside a request the route has
 * already authenticated (feed reranking, opportunity query generation).
 *
 * This function stays **synchronous** — eleven call sites use its result without
 * `await`, and wrapping is pure object construction.
 */
export function resolveProvider(
  override?: ProviderOverrideConfig | null,
  ctx?: { userId?: string | null; byok?: boolean; path?: string },
): DigestProvider | null {
  const byok = hasUsableProviderOverride(override);
  const provider = byok
    ? resolveUserProvider(override)
    : canUseLocalServerProvider()
      ? resolveLocalServerProvider()
      : null;
  if (!provider) return null;
  return meterProvider(provider, {
    userId: ctx?.userId ?? null,
    byok: ctx?.byok ?? byok,
    path: ctx?.path,
  });
}
