# Hermes Product Direction

Source: https://hermes-admin-eta.vercel.app/
Captured: 2026-04-30

This document is the durable project guideline for Hermes product and architecture decisions. When future work touches product direction, information architecture, ranking, retrieval, UX, or output design, use this document as the decision filter.

If this document conflicts with the live admin site, the live admin site wins.

## Core Product Idea

Hermes is a calm information agent for career, work, research, and knowledge. It should feel like a daily forecast: concise, precise, and useful enough to check every morning.

The product is not trying to maximize reading volume. It is trying to save the user time.

Hard rule:

> Ten precise items are better than one hundred noisy items.

## Product Philosophy

1. Time efficiency over information volume

Hermes should reduce noise. The user should receive a small number of high-signal items with clear reasons, not a large pile of generic recommendations.

2. User-declared intent

The user explicitly declares who they are, what they care about, what project they are working on, and what problems they are trying to solve. Hermes should optimize from that stated intent instead of guessing from scratch.

3. File over app

Hermes output should remain portable. Markdown, frontmatter, wikilinks, email, feeds, and JSON are preferred over proprietary lock-in. If Hermes disappears, the user should still own the information.

4. Progressive complexity

A new user should be able to start quickly with a few interests. Power users should be able to tune sources, scoring, outputs, and feedback behavior deeply.

5. Reliability through degradation

Hermes must remain useful without external LLMs. Cloud APIs improve quality, but the core system should keep working when keys are missing, budgets are exhausted, or external services fail.

## Five-Stage Pipeline

All major information features should fit this pipeline unless there is a strong reason not to:

1. Source collection

Fetch raw content concurrently from configured adapters. Each adapter should isolate failures so one broken source does not break the whole run.

2. Relevance scoring

Score every item against the user profile. Tier 0 uses keyword and TF-IDF. Tier 1 adds embeddings and local models. Tier 2 adds cloud LLM reasoning.

3. Deduplication and clustering

Merge duplicate or near-duplicate items across sources. Prefer exact URL normalization first, then approximate matching such as MinHash or embeddings.

4. Content distillation

Turn raw source material into a concise user-facing summary, relevance reason, and optional extracted facts. Distillation quality should improve by tier but the UI shape should remain stable.

5. Formatted output

Render to the selected output surface: app feed, Markdown, Obsidian, email, RSS, JSON, Telegram, Slack, or another adapter.

## Three-Tier Intelligence Model

Hermes should use progressive enhancement, not all-or-nothing AI.

### Tier 0: Rule Engine

The floor. Must work without model keys or local model setup.

Use:

- Keyword matching
- TF-IDF
- Regex rules
- Source weights
- Recency
- MinHash or simple near-duplicate detection
- Extractive summaries

Design implication: every core UX must still make sense at Tier 0.

### Tier 1: Local Models

Privacy-preserving semantic improvement.

Use:

- Local embeddings
- Sentence-transformers
- Ollama or llama.cpp
- Local summary generation
- Semantic similarity for related terms

Design implication: Tier 1 should improve matching and summaries without changing the product into a chatbot.

### Tier 2: Cloud LLM

Best-quality reasoning, optional, and budgeted.

Use:

- OpenAI, Anthropic, Gemini, or similar providers
- BYOK where possible
- Token budgets
- Fallback to lower tiers
- JSON-structured extraction
- Personalized relevance explanations

Design implication: cloud LLMs should add judgment and synthesis, not become a hard dependency.

## Source Adapter Direction

Hermes should grow retrieval through adapters, not one-off code paths.

Target source families:

- Academic: arXiv, Semantic Scholar, PubMed, OpenAlex
- Community: Hacker News, Reddit, Lobsters, V2EX
- News and blogs: RSS and Atom feeds
- Custom URLs: browser or crawler-based extraction
- Future private sources: user documents, saved papers, lab feeds, internal notes

Adapter rule:

Each source should expose a standard fetch and parse shape. The core pipeline should not need source-specific logic except for normalization and trust weighting.

## Output Direction

Primary outputs should preserve ownership and portability.

Preferred output surfaces:

- App feed for daily use
- Markdown daily notes
- Obsidian vault integration
- Email digest
- Private RSS or Atom feed
- JSON API
- Telegram or Slack notifications

Obsidian direction:

- Daily file named by date
- Frontmatter for date, tags, sources
- Sections by interest area
- Relevance score and source link per item
- Wikilinks to existing notes where possible
- Stub notes for new concepts where useful

## Feedback Loop

Feedback should continuously improve retrieval and ranking.

Explicit feedback:

- Save
- More like this
- Not interested
- Like or dislike

Implicit feedback, when available:

- Opened source link
- Read item detail page
- Dismissed item
- Repeatedly ignored a category

Ranking updates should be gradual. Use moving averages or similar smoothing so one click does not overcorrect the profile.

## Product Evolution

### v0: CLI and Core Engine

A self-hosted engine with config, scheduled runs, scoring, dedupe, and Markdown output.

### v1: Open Product

Obsidian integration, Docker image, Web UI configuration, adapters, feedback loop, and community contribution paths.

### v2 and Later

Do not over-specify too early. Future direction should depend on user behavior, community feedback, and whether hosted services or team workflows become necessary.

## Design Decision Filter

Before adding or changing a feature, ask:

1. Does this save the user time, or does it add more information to manage?
2. Does it respect the user's explicitly declared intent?
3. Does it preserve a useful Tier 0 path?
4. Does it fit the five-stage pipeline?
5. Can it degrade gracefully when a source, model, or provider fails?
6. Does it keep output portable where possible?
7. Does it strengthen the feedback loop?
8. Does it keep daily Hermes calm and concise?

If the answer is mostly no, the feature probably belongs in a later deep-dive mode, a power-user setting, or not in Hermes.

## Daily Mode vs Deep-Dive Mode

Daily Hermes is passive, concise, and ritual-like. It should provide a small forecast of what matters today.

Deep-dive Hermes is active, investigative, and more expensive. It may use a planner, sub-agents, human plan review, web crawling, and long-form reports.

Hard boundary:

Do not let deep-dive architecture turn the whole product into a generic agent platform. Deep-dive is one feature. The daily forecast remains the core identity.

## Non-Negotiable Product Rules

- Prioritize precision over volume.
- Keep the core pipeline understandable.
- Keep source adapters modular.
- Keep scoring inspectable where possible.
- Keep cloud LLMs optional and budgeted.
- Keep user data portable.
- Keep daily output calm, short, and actionable.
- Build deeper controls for power users without forcing complexity onto everyone.
