---
name: bottlefind-radar
description: >
  BottleFind Radar for multi-source trend discovery and hotspot monitoring.
  Use when users ask for trending topics, latest updates, keyword tracking,
  weekly/daily hotspot reports, or cross-platform AI/tech/news signals.
  Supports Chinese and international sources including Bing, Google,
  DuckDuckGo, HackerNews, Sogou, Bilibili, Weibo, and Twitter.
---

# BottleFind Radar

BottleFind Radar is a lightweight trend intelligence skillset.
It collects hotspot candidates from 8+ sources, then supports downstream AI relevance filtering and report generation.

## Quick Start

All scripts are under `scripts/`.

Install dependencies:

```bash
pip install -r scripts/requirements.txt
```

Optional environment variable (Twitter source only):

```bash
export TWITTER_API_KEY=your_key
```

## Core Workflow

### 1. Clarify User Intent

Classify requests before running scripts:

- Broad discovery: "What is trending in AI this week?"
- Focused tracking: "Track GPT-5 and Claude updates"
- Report generation: "Generate a daily hotspot report"

### 2. Collect Candidate Signals

International web:

```bash
python scripts/search_web.py "AI programming" --sources bing,hackernews,duckduckgo
```

Chinese platforms:

```bash
python scripts/search_china.py "AI编程" --sources sogou,bilibili,weibo
```

Twitter/X:

```bash
python scripts/search_twitter.py "AI programming"
```

Each script prints JSON to stdout.

### 3. Score and Filter

Apply your own analysis logic on top of collected signals:

1. `isReal`: authenticity / rumor check
2. `relevance`: 0-100 keyword relevance
3. `importance`: low / medium / high / urgent
4. `summary`: concise Chinese summary

Detailed guide:

- `references/analysis-guide.md`

### 4. Render Final Report

Generate a structured report grouped by importance tiers.
If needed, use:

```bash
python scripts/generate_report.py
```

## Script Matrix

| Script | Data Sources | API Key | Output |
|---|---|---|---|
| `search_web.py` | Bing / Google / DuckDuckGo / HackerNews | No | JSON list |
| `search_china.py` | Sogou / Bilibili / Weibo | No | JSON list |
| `search_twitter.py` | Twitter/X | `TWITTER_API_KEY` | JSON list |
| `generate_report.py` | N/A | No | Markdown report |

## Advanced Usage

- Keyword expansion: bilingual synonyms + abbreviations.
- Creator detection: use `--detect-account` with Bilibili name matching.
- Batch monitoring: queue multiple keywords with source-aware throttling.

## References

- [analysis-guide.md](references/analysis-guide.md)
- [search-sources.md](references/search-sources.md)
