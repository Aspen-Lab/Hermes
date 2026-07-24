// Tier-0 observability: one place to record what every LLM call actually cost.
//
// Providers call `logLlmUsage` after each request so we can see, per call, the
// model used, token counts (including hidden thinking/reasoning tokens where the
// API reports them), and wall-clock latency. This is the measurement layer the
// API-efficiency work is built on — you cannot claim a speed/token win you can't
// see.
//
// SAFETY: never log API keys, prompt/response text, private profile context, or
// image bytes. Only numeric counts + model ids.

export interface LlmUsage {
  provider: string;
  model: string;
  /** Logical call site, e.g. "digest", "rerank", "report:pass2", "figure:vision". */
  path?: string;
  inputTokens?: number;
  outputTokens?: number;
  /** Gemini "thoughts" / OpenAI "reasoning" tokens, when the API reports them. */
  thinkingTokens?: number;
  latencyMs: number;
  ok: boolean;
}

/** Emit a single compact line per LLM call. Safe to call in any runtime. */
export function logLlmUsage(u: LlmUsage): void {
  const parts = [
    `[llm] ${u.provider}/${u.model}`,
    u.path ? `path=${u.path}` : null,
    u.inputTokens != null ? `in=${u.inputTokens}` : null,
    u.outputTokens != null ? `out=${u.outputTokens}` : null,
    u.thinkingTokens ? `think=${u.thinkingTokens}` : null,
    `${Math.round(u.latencyMs)}ms`,
    u.ok ? "ok" : "ERR",
  ].filter(Boolean);
  console.log(parts.join(" "));
}

/** Milliseconds since an epoch marker; wrapper so call sites read cleanly. */
export function now(): number {
  return Date.now();
}
