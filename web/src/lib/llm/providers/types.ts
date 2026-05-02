import { cleanDisplayText } from "@/lib/text/clean";

export type ProviderId = "anthropic" | "gemini" | "openai" | "ollama";

export interface ProviderOverrideConfig {
  provider: Exclude<ProviderId, "ollama">;
  apiKey: string;
  model?: string;
}

export interface PaperLite {
  id: string;
  title: string;
  authors?: string[];
  venue?: string;
  abstract?: string;
}

export interface PerPaperExtract {
  headlineFinding?: string;
  keyNumbers?: { value: string; label: string }[];
}

export interface DigestBullet {
  paperId: string;
  text: string;
}

export interface DigestResult {
  bullets: DigestBullet[];
  perPaper: Record<string, PerPaperExtract>;
}

export interface VisionImageInput {
  dataBase64: string;
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/gif";
}

export interface DigestProvider {
  id: ProviderId;
  generateDigest(args: {
    papers: PaperLite[];
    contextHint?: string;
  }): Promise<DigestResult>;
  generateJsonText?(args: {
    systemPrompt: string;
    userPrompt: string;
    maxTokens?: number;
  }): Promise<string>;
  generateVisionJsonText?(args: {
    systemPrompt: string;
    userPrompt: string;
    images: VisionImageInput[];
    maxTokens?: number;
  }): Promise<string>;
  testConnection(): Promise<{ ok: boolean; error?: string }>;
}

// ── Shared prompt helpers (same prompt across all providers) ────

export const DIGEST_SYSTEM_PROMPT = `You are Hermes, a calm research messenger that produces a structured daily briefing for a researcher.

Your task: given today's papers and the user's project context, write ONE focused sentence per paper that captures its key result — not the topic, the actual finding. Tone: weather-forecast — confident, distilled, never breathless. Lead with the result (e.g. "Pulsed electrodeposition achieves (104)-oriented LCO at sub-5 mA/cm² without 500 °C anneal."), not a description of what the paper does.

IMPORTANT — formatting: Write in plain readable text only. Do NOT use LaTeX notation (no $...$ math, no _{...} subscripts, no ^{...} superscripts). Write chemical formulas and math in plain Unicode — use actual subscript characters (₀₁₂₃₄₅₆₇₈₉) or write them inline (e.g. Na0.66Mn0.8Fe0.2O2, CO2, Li-ion, x=0.5). This applies to ALL output strings.

After the bullet summaries, extract for each paper:
- a single-sentence headline finding (the result, not the topic)
- 2-3 key numerical results, each as { value, label } (e.g. {"value":"92%","label":"capacity after 500 cycles"})

Return ONLY valid JSON matching this schema exactly:
{
  "bullets": [
    { "paperId": "<exact paper id from input>", "text": "One-sentence finding." }
  ],
  "perPaper": {
    "<paper_id>": {
      "headlineFinding": "string",
      "keyNumbers": [{"value":"...", "label":"..."}]
    }
  }
}

Include one bullet per paper, in the same order as the input list. If a paper has no clear numerical result, omit keyNumbers for it. Never fabricate numbers.`;

export function buildUserPrompt(papers: PaperLite[], contextHint?: string): string {
  const contextSection = contextHint
    ? `User context (their current project / open challenges):\n${contextHint}\n\n`
    : "";
  const papersSection = papers
    .map((p, i) => {
      const authors = p.authors?.slice(0, 3).join(", ") ?? "";
      const title = cleanDisplayText(p.title);
      const abstract = p.abstract ? cleanDisplayText(p.abstract) : "(no abstract available)";
      return `[${i + 1}] id=${p.id}\nTitle: ${title}\nAuthors: ${authors}\nVenue: ${p.venue ?? "—"}\nAbstract: ${abstract}\n`;
    })
    .join("\n");
  return `${contextSection}Papers:\n\n${papersSection}\n\nProduce the JSON now.`;
}

export function safeParseDigest(text: string): DigestResult | null {
  // Gemini 2.5 thinking models may include reasoning text before/after the JSON.
  // Strategy: try direct parse, then strip fences, then extract first {...} block.
  const candidates: string[] = [
    text.trim(),
    text.replace(/^```json\s*/i, "").replace(/```\s*$/g, "").trim(),
  ];

  // Extract the first top-level JSON object from anywhere in the text.
  const match = text.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);

  for (const candidate of candidates) {
    try {
      const obj = JSON.parse(candidate) as Partial<DigestResult>;
      if (!Array.isArray(obj.bullets) || obj.bullets.length === 0) continue;
      const perPaper = (obj.perPaper && typeof obj.perPaper === "object")
        ? Object.fromEntries(
            Object.entries(obj.perPaper).map(([paperId, extract]) => {
              const value = extract as PerPaperExtract;
              return [
                paperId,
                {
                  headlineFinding: cleanDisplayText(value.headlineFinding),
                  keyNumbers: Array.isArray(value.keyNumbers)
                    ? value.keyNumbers.map((n) => ({
                        value: cleanDisplayText(n.value),
                        label: cleanDisplayText(n.label),
                      })).filter((n) => n.value || n.label)
                    : undefined,
                },
              ];
            }),
          )
        : {};
      return {
        bullets: obj.bullets.filter(
          (b) => typeof b.paperId === "string" && typeof b.text === "string"
        ).map((b) => ({ paperId: b.paperId, text: cleanDisplayText(b.text) })),
        perPaper,
      };
    } catch {
      // try next candidate
    }
  }

  console.warn("[digest] Could not parse JSON from model response. First 300 chars:", text.slice(0, 300));
  return null;
}
