# Hermes Project Rules

For product, UX, retrieval, ranking, architecture, and output-design work, read and follow:

- `docs/PRODUCT_DIRECTION.md`
- Source of truth: https://hermes-admin-eta.vercel.app/

Hard rule: Hermes is a calm daily forecast for career, work, research, and knowledge. Favor precise, portable, user-declared, progressively enhanced information delivery over generic agent-platform complexity.

Decision priorities:

- Time efficiency over information volume.
- User-declared intent over guessed preference.
- Tier 0 must remain useful without model keys.
- Tier 1 and Tier 2 may improve quality but must degrade gracefully.
- Source collection, scoring, dedupe, distillation, and output should remain the core pipeline.
- Output should stay portable where possible: Markdown, Obsidian, email, feeds, JSON.
- Feedback should tune future retrieval gradually, not overreact to one signal.
- Deep-dive mode is a feature, not the product identity.
