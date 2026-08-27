const OPERATOR_AI_ENV_NAMES = [
  "PEER_DIGEST_PROVIDER",
  "GOOGLE_VERTEX_PROJECT",
  // The Vertex AI Search app is operator-funded search, spent from the
  // server's own project exactly as grounding is, so it belongs on this list
  // for the same reason `GOOGLE_VERTEX_PROJECT` does.
  "GOOGLE_VERTEX_SEARCH_PROJECT",
  "GOOGLE_VERTEX_SEARCH_ENGINE_ID",
  "GOOGLE_VERTEX_SEARCH_DATA_STORE_ID",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "QWEN_API_KEY",
  "DASHSCOPE_API_KEY",
  "DEEPSEEK_API_KEY",
];

function isVercelBuild(env) {
  return Boolean(env.VERCEL || env.VERCEL_ENV);
}

function configuredOperatorAiNames(env) {
  return OPERATOR_AI_ENV_NAMES.filter((name) => Boolean(env[name]?.trim()));
}

if (isVercelBuild(process.env)) {
  const configured = configuredOperatorAiNames(process.env);
  const forcedAiTier = Number(process.env.PEER_FEED_AI_TIER ?? "0");

  if (configured.length > 0 || forcedAiTier > 0) {
    const problems = [
      ...configured,
      ...(forcedAiTier > 0 ? ["PEER_FEED_AI_TIER"] : []),
    ];
    console.error(
      [
        "Peer deployment blocked: production and preview are BYOK-only.",
        `Remove these operator-funded AI settings from Vercel: ${problems.join(", ")}.`,
        "Local .env.local Vertex credentials remain supported by `next dev`.",
      ].join("\n"),
    );
    process.exit(1);
  }
}
