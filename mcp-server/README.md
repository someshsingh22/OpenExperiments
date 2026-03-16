# OpenExperiments MCP Server

MCP (Model Context Protocol) server for [OpenExperiments](https://openexperiments.pages.dev) — gives LLMs access to hypothesis discovery, dataset exploration, and guided hypothesis formulation.

## Tools

| Tool                      | Description                                          |
| ------------------------- | ---------------------------------------------------- |
| `platform_overview`       | Stats, domains, lifecycle — call first to orient     |
| `list_problem_statements` | All open research questions with linked datasets     |
| `list_datasets`           | All Hugging Face datasets with column schemas        |
| `get_dataset`             | Deep dive into one dataset                           |
| `search_hypotheses`       | Keyword search across hypotheses                     |
| `get_hypothesis`          | Full hypothesis detail with experiments and comments |
| `get_arena_rankings`      | Leaderboard by community vote win rate               |
| `list_experiments`        | Browse experiments, filter by hypothesis             |
| `get_experiment`          | Full experiment detail with stats                    |
| `generate_submission_url` | Pre-filled link to the submit page                   |

## Prompts

| Prompt                 | Description                                                            |
| ---------------------- | ---------------------------------------------------------------------- |
| `formulate-hypothesis` | Loads all context to help turn a rough idea into a testable hypothesis |
| `co-ideate`            | Brainstorm new research directions from existing work                  |

## Philosophy: ExperiGen Feature Extractability

The MCP server guides users based on the **ExperiGen** approach ([arxiv.org/abs/2602.07983](https://arxiv.org/abs/2602.07983)):

**Core Principle**: Hypotheses must test features COMPUTABLE from available dataset columns.

**✅ Extractable Features:**

- **Code-based**: Brightness from pixels, length from text, counts, ratios
- **NLP/LLM-based**: Sentiment, readability, named entities, topics from text
- **VLM-based**: Face count, object types, scene category from images
- **Statistical**: Correlations, aggregations from numerical data

**❌ Not Extractable:**

- Viewer's mood (not stored in data)
- Author's true intent (not measurable)
- Temporal features when timestamps missing
- User demographics when data is anonymized

**Example**: "Warm colors make images more memorable" is testable because color can be extracted from RGB pixel values. "Viewer's mood affects memory" is NOT testable because mood isn't in the dataset.

## Domain Flexibility

The MCP server accepts hypotheses in **any domain**, not just persuasion/memorability:

- **Standard domains**: `persuasion`, `memorability` (fully supported)
- **New domains**: `attention`, `learning`, `decision-making`, etc. (exploratory)
- Users can propose problem statements in any domain
- Problem statements can exist without datasets initially
- Datasets can be suggested via GitHub PR later

When generating submission URLs for non-standard domains, the MCP shows a warning explaining the current platform restrictions and how to propose new domains.

## Quick Start (Local Development)

```bash
# 1. Install and build
cd mcp-server
npm install
npm run build

# 2. Configure (choose one)
bash configure-claude-code.sh      # For Claude Code CLI
bash configure-claude-desktop.sh   # For Claude Desktop app

# 3. Start your local dev server (in main project)
cd ..
npm run dev
```

See [LOCAL_SETUP.md](./LOCAL_SETUP.md) for detailed local development instructions.

## Setup

### 1. Install

```bash
cd mcp-server
npm install
npm run build
```

### 2. Configure in Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openexperiments": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "OPENEXPERIMENTS_API_URL": "https://openexperiments.pages.dev"
      }
    }
  }
}
```

### 3. Configure in Claude Code

```bash
claude mcp add openexperiments node /absolute/path/to/mcp-server/dist/index.js
```

Or add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "openexperiments": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "OPENEXPERIMENTS_API_URL": "https://openexperiments.pages.dev"
      }
    }
  }
}
```

## Environment Variables

| Variable                   | Default                             | Description                  |
| -------------------------- | ----------------------------------- | ---------------------------- |
| `OPENEXPERIMENTS_API_URL`  | `https://openexperiments.pages.dev` | API base URL                 |
| `OPENEXPERIMENTS_SITE_URL` | Same as API URL                     | Site URL for generated links |

Configuration priority (highest to lowest):

1. Environment variables in Claude config (`env` field)
2. `.env` file in `mcp-server/` directory
3. Built-in defaults (production URLs)

For local development, the `.env` file is pre-configured to use `localhost:3000`. Just start your dev server and it works.

To override for production, edit `mcp-server/.env` or add `env` to your Claude config:

```json
{
  "mcpServers": {
    "openexperiments": {
      "command": "node",
      "args": ["/path/to/dist/index.js"],
      "env": {
        "OPENEXPERIMENTS_API_URL": "https://openexperiments.pages.dev"
      }
    }
  }
}
```

## Development

```bash
npm run dev     # Run with tsx (no build needed)
npm run build   # Compile TypeScript
npm start       # Run compiled output
```

## Testing

See [TESTING.md](./TESTING.md) for the full testing plan.

Quick smoke test with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
