import Anthropic from "@anthropic-ai/sdk";
import type {
  DigestProvider,
  DigestResult,
  VisionImageInput,
} from "./types";
import { DIGEST_SYSTEM_PROMPT, buildUserPrompt, safeParseDigest } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

function getClient(apiKey?: string): Anthropic | null {
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  return new Anthropic({ apiKey: key });
}

export function createAnthropicProvider(
  apiKey?: string,
  model = MODEL,
): DigestProvider {
  return {
    id: "anthropic",

    async generateDigest({ papers, contextHint }): Promise<DigestResult> {
      const client = getClient(apiKey);
      if (!client) throw new Error("ANTHROPIC_API_KEY not set");

      const response = await client.messages.create({
        model,
        max_tokens: 1500,
        system: DIGEST_SYSTEM_PROMPT,
        messages: [{ role: "user", content: buildUserPrompt(papers, contextHint) }],
      });

      const block = response.content[0];
      if (!block || block.type !== "text") throw new Error("Unexpected response shape");
      const parsed = safeParseDigest(block.text);
      if (!parsed) throw new Error("Failed to parse digest JSON");
      return parsed;
    },

    async generateJsonText({ systemPrompt, userPrompt, maxTokens = 1500 }): Promise<string> {
      const client = getClient(apiKey);
      if (!client) throw new Error("ANTHROPIC_API_KEY not set");

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = response.content[0];
      if (!block || block.type !== "text") throw new Error("Unexpected response shape");
      return block.text.trim();
    },

    async generateVisionJsonText({
      systemPrompt,
      userPrompt,
      images,
      maxTokens = 1200,
    }): Promise<string> {
      const client = getClient(apiKey);
      if (!client) throw new Error("ANTHROPIC_API_KEY not set");
      if (images.length === 0) throw new Error("No images supplied");

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: userPrompt },
              ...images.map((image: VisionImageInput) => ({
                type: "image" as const,
                source: {
                  type: "base64" as const,
                  data: image.dataBase64,
                  media_type: image.mimeType,
                },
              })),
            ],
          },
        ],
      });

      const block = response.content[0];
      if (!block || block.type !== "text") throw new Error("Unexpected response shape");
      return block.text.trim();
    },

    async testConnection(): Promise<{ ok: boolean; error?: string }> {
      const client = getClient(apiKey);
      if (!client) return { ok: false, error: "ANTHROPIC_API_KEY not set" };
      try {
        await client.messages.create({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "ping" }],
        });
        return { ok: true };
      } catch (err) {
        return { ok: false, error: String(err) };
      }
    },
  };
}

export const anthropicProvider: DigestProvider = createAnthropicProvider();
