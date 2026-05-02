import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getAnthropicClient(): Anthropic | null {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  if (cached) return cached;
  cached = new Anthropic({ apiKey: key });
  return cached;
}

export const DIGEST_MODEL = "claude-haiku-4-5-20251001";
