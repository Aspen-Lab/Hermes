<p align="center">
  <img src="assets/logo.svg" alt="Hermes" width="180" />
</p>

<h1 align="center">Hermes</h1>

<p align="center">
  <em>Self-hosted information agent. Turns the RSS / Hacker News / arXiv / Reddit firehose into ten items you actually care about, delivered as markdown to your vault.</em>
</p>

<p align="center">
  <img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-141414?style=flat-square" />
  <img alt="Python 3.11+" src="https://img.shields.io/badge/python-3.11%2B-F58414?style=flat-square" />
  <img alt="Status: v0 MVP" src="https://img.shields.io/badge/status-v0%20MVP-F58414?style=flat-square" />
  <img alt="PRs welcome" src="https://img.shields.io/badge/PRs-welcome-141414?style=flat-square" />
  <img alt="Self-hosted" src="https://img.shields.io/badge/self--hosted-%E2%9C%93-141414?style=flat-square" />
</p>

Stop doom-scrolling five tabs every morning. Declare what you care about in a YAML file. Hermes fetches from your sources, scores each item 0–1 for relevance, deduplicates across feeds, and writes a daily digest you can read in two minutes.

**Status:** v0 MVP. Tier 0 (TF-IDF, zero model dependencies) works today. Tier 1 (local models) and Tier 2 (cloud APIs) are on the roadmap.

## Why Hermes

- **Local-first.** YAML config + SQLite. No account, no server, no data leaves your machine.
- **LLM-optional.** Runs entirely on rules and TF-IDF by default. Plug in Ollama or an API key only if you want richer summaries.
- **File over app.** Output is plain markdown. If Hermes disappears tomorrow, your notes still work.

## Quick start

```bash
git clone <this repo>
cd hermes/python
pip install -e .

hermes init                 # writes hermes.yml in the current directory
# edit hermes.yml — add your keywords and sources
hermes run --once
```

Your daily digest lands in `~/hermes-output/` as `YYYY-MM-DD.md`. Run it on cron (or launchd / systemd timer) for a morning briefing.

## How it works

A five-stage pipeline:

1. **Collect** — parallel async fetching from configured sources
2. **Score** — 0–1 relevance per item, based on your profile
3. **Dedupe** — merge the same story across sources
4. **Distill** — generate a per-item summary
5. **Render** — write markdown (or push to email / Telegram / API)

Three tiers of intelligence. Pick one; Hermes degrades gracefully between them.

| Tier            | What it uses                                        | Dependencies   | RAM     |
| --------------- | --------------------------------------------------- | -------------- | ------- |
| **0** (default) | TF-IDF + keyword rules + MinHash dedup              | None           | ~50 MB  |
| **1** (planned) | sentence-transformers + local LLM (Ollama, llama.cpp) | 1 model        | ~16 GB  |
| **2** (planned) | Cloud LLMs (OpenAI, Anthropic) via BYOK             | API key        | —       |

If Tier 2 blows its daily token budget, Hermes falls back to Tier 1, then Tier 0. Nothing halts because the cloud is down.

## Sources

**Built today:** Hacker News, Reddit, arXiv, RSS / Atom.

**Planned:** Semantic Scholar, PubMed, OpenAlex, Lobsters, V2EX, arbitrary URLs via Playwright.

**Custom sources.** Drop a Python file into `sources/` that subclasses `BaseSource` and implements `fetch()` / `parse()`. Hermes auto-registers it on startup. No plugin manifest, no registration boilerplate.

## Outputs

**Built today:** markdown digest file, one per day.

**Planned:**

- **Obsidian** — frontmatter + `[[wikilinks]]` into your existing vault, auto-stubs for new concepts
- **Email** — HTML + plain text via SMTP or SendGrid
- **Telegram / Slack** — bot API with inline up/down feedback buttons
- **Feeds** — private Atom feed for any RSS reader; JSON API at `GET /api/today`

Feedback loop (planned): you mark items up or down in the output, the next run adjusts keyword weights and source priority via EMA — no over-correction from single signals.

## Configuration

Minimal `hermes.yml`:

```yaml
profile:
  keywords: ["machine learning", "distributed systems"]

sources:
  - name: hn
    type: hackernews
    min_points: 20

  - name: arxiv
    type: arxiv
    query: "cat:cs.AI OR cat:cs.LG"
    max_results: 50

engine:
  weights:
    tfidf: 0.50
    keyword: 0.30
    source: 0.20
  min_score: 0.15
  max_items: 50
  dedup_window_days: 30

output:
  format: markdown
  path: "~/hermes-output"

storage:
  path: "~/.hermes/hermes.db"
```

Full reference: [`python/config.example.yaml`](python/config.example.yaml).

## Web dashboard (optional)

A Next.js dashboard in `web/` gives you a browser view of the feed plus live academic search (OpenAlex-backed, no API key required).

```bash
cd web
npm install
npm run dev   # http://localhost:3000
```

## Project layout

```
python/   # CLI + pipeline (the core engine)
web/      # Next.js dashboard (optional convenience UI)
```

## Roadmap

- **v0 MVP (now)** — 5 sources + TF-IDF + markdown
- **v0.5** — Obsidian plugin, feedback loop, Docker Compose
- **v1.0** — community adapter contribution process, profile templates (researcher, VC, PM, trader, indie dev), Product Hunt launch

Full plan and architecture notes: <https://hermes-admin-eta.vercel.app/>

## Contributing

Early days. Issues and PRs welcome — especially source adapters. Open an issue first for anything larger than a bugfix so we can align on fit.

## License

MIT.
