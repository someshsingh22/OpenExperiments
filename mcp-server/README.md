# OpenExperiments MCP Server

MCP (Model Context Protocol) server for [OpenExperiments](https://openexperiments.pages.dev) — gives LLMs access to hypothesis discovery, dataset exploration, and guided hypothesis formulation.

## Tools

| Tool | Description |
|------|-------------|
| `platform_overview` | Stats, domains, lifecycle — call first to orient |
| `list_problem_statements` | All open research questions with linked datasets |
| `list_datasets` | All Hugging Face datasets with column schemas |
| `get_dataset` | Deep dive into one dataset |
| `search_hypotheses` | Keyword search across hypotheses |
| `get_hypothesis` | Full hypothesis detail with experiments and comments |
| `get_arena_rankings` | Leaderboard by community vote win rate |
| `list_experiments` | Browse experiments, filter by hypothesis |
| `get_experiment` | Full experiment detail with stats |
| `generate_submission_url` | Pre-filled link to the submit page |

## Prompts

| Prompt | Description |
|--------|-------------|
| `formulate-hypothesis` | Loads all context to help turn a rough idea into a testable hypothesis |
| `co-ideate` | Brainstorm new research directions from existing work |

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

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENEXPERIMENTS_API_URL` | `https://openexperiments.pages.dev` | API base URL |
| `OPENEXPERIMENTS_SITE_URL` | Same as API URL | Site URL for generated links |

For local development, point to your local server:

```bash
OPENEXPERIMENTS_API_URL=http://localhost:3000 npm run dev
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
