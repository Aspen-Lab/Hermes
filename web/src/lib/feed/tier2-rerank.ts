import { resolveProvider } from "@/lib/llm/providers/registry";
import type { ProviderOverrideConfig } from "@/lib/llm/providers/types";
import type { ScoredItem } from "@/lib/scoring/types";
import type { SearchBrief } from "./profile-compiler";

interface RerankResponse {
  orderedIds?: string[];
  reasons?: Record<string, string>;
}

export async function applyTier2Rerank(
  items: ScoredItem[],
  brief: SearchBrief,
  llmOverride?: ProviderOverrideConfig,
): Promise<ScoredItem[]> {
  const provider = resolveProvider(llmOverride);
  if (!provider?.generateJsonText || items.length === 0) return items;

  const candidates = items.slice(0, 50);
  // Only the leading items are ever shown, so we only need written reasons for
  // those — generating a reason for all 50 is the bulk of the output tokens and
  // the main latency driver. Rank all 50, but explain only the top ~20.
  const REASON_LIMIT = 20;
  const systemPrompt = [
    "You are Peer's feed critic.",
    "Rank papers for a calm daily research forecast.",
    "Prefer papers that directly help the user's current project or open questions.",
    "Avoid broad, generic, old, or weakly related papers unless they are clearly useful.",
    `Return orderedIds for ALL candidates, but include reasons for ONLY the top ${REASON_LIMIT}.`,
    "Return only JSON.",
  ].join(" ");

  const userPrompt = JSON.stringify({
    searchBrief: {
      coreTopics: brief.coreTopics,
      activeQuestions: brief.activeQuestions,
      mustInclude: brief.mustInclude,
      niceToHave: brief.niceToHave,
      avoid: brief.avoid,
      methods: brief.methods,
      controls: brief.controls,
    },
    candidates: candidates.map((item) => ({
      id: item.id,
      title: item.title,
      abstract: item.abstract?.slice(0, 1200),
      venue: item.venue,
      source: item.source,
      score: item.score,
      citations: item.metadata.citationCount ?? 0,
    })),
    outputSchema: {
      orderedIds: ["every candidate id, best-to-worst order"],
      reasons: { "paper id": `short plain-English reason — top ${REASON_LIMIT} ids only` },
    },
  });

  try {
    const raw = await provider.generateJsonText({
      systemPrompt,
      userPrompt,
      maxTokens: 2200,
      tier: "small",
    });
    const parsed = parseRerankResponse(raw);
    if (!Array.isArray(parsed.orderedIds)) return items;

    const byId = new Map(items.map((item) => [item.id, item]));
    const ordered = parsed.orderedIds
      .map((id) => byId.get(id))
      .filter((item): item is ScoredItem => Boolean(item))
      .map((item, index) => {
        const aiBoost = Math.max(0, 0.12 - index * 0.002);
        const combined = Math.max(0, Math.min(1, item.score + aiBoost));
        return {
          ...item,
          score: combined,
          scoreBreakdown: {
            ...item.scoreBreakdown,
            combined,
          },
          relevanceReason: parsed.reasons?.[item.id] || item.relevanceReason,
        };
      });

    const orderedIds = new Set(ordered.map((item) => item.id));
    const rest = items.filter((item) => !orderedIds.has(item.id));
    return [...ordered, ...rest];
  } catch (err) {
    console.warn("[feed/tier2] rerank failed, keeping Tier 1 order:", err);
    return items;
  }
}

function parseRerankResponse(text: string): RerankResponse {
  const candidates = [
    text.trim(),
    text.replace(/^```json\s*/i, "").replace(/```\s*$/g, "").trim(),
  ];
  const match = text.match(/\{[\s\S]*\}/);
  if (match) candidates.push(match[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as RerankResponse;
      return parsed;
    } catch {
      // Try the next candidate.
    }
  }

  return {};
}
