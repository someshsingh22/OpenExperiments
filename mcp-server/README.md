# OpenExperiments MCP Server

Model Context Protocol (MCP) server for OpenExperiments. It exposes the website workflows to AI assistants: account lookup, hypothesis discovery/submission, comments, stars, arena voting, experiment planning/versioning, dataset registration, profiles, prompts, and resources.

Version: **1.2.0**

## Features

- Runtime-neutral shared registration module (`src/register.ts`) for stdio and the remote worker.
- Authenticated writes through `Authorization: Bearer <token>` when `OPENEXPERIMENTS_TOKEN` is set.
- Read-only tools for the full public site surface, plus idempotent star/unstar wrappers around the toggle API.
- Write tools include confirmation-oriented descriptions so clients should show exact content before calling.
- Central timeout/error handling: 401/403/404/409/400/422/429/5xx/network failures become MCP `isError` results.

## Tools

| Tool | Mode | Auth | Purpose |
| --- | --- | --- | --- |
| `whoami` | Read | Optional | Show the signed-in user or token setup help. |
| `platform_overview` | Read | No | Platform stats, lifecycle, workflow, and feature-extractability guidance. |
| `list_problem_statements` | Read | No | List research questions and linked datasets. |
| `list_datasets` | Read | No | Browse datasets by domain. |
| `get_dataset` | Read | No | Dataset detail, OSF characterization, problem statements, experiments. |
| `submit_dataset` | Write | Yes | Register a Hugging Face dataset with OSF-style fields. |
| `browse_hypotheses` | Read | No | Full explore filters: domain, phase, status, problem statement/search, sort, limit/offset. |
| `search_hypotheses` | Read | No | Back-compatible keyword search. |
| `get_hypothesis` | Read | No | Hypothesis detail with experiments, comments, citations. |
| `submit_hypothesis` | Write | Yes | Submit a confirmed hypothesis. |
| `add_citation` | Write | Yes | Add DOI/arXiv citation to the author's hypothesis. |
| `generate_submission_url` | Read | No | Create prefilled `/submit` URL. |
| `get_my_hypotheses` | Read | Yes | Authenticated user's hypotheses. |
| `list_comments` | Read | No | Comments for a hypothesis. |
| `post_comment` | Write | Yes | Post comment or reply. |
| `get_star_status` | Read | Optional | Star count and viewer status. |
| `star_hypothesis` | Write | Yes | Idempotently star a hypothesis. |
| `unstar_hypothesis` | Write | Yes | Idempotently unstar a hypothesis. |
| `get_arena_rankings` | Read | No | Arena leaderboard. |
| `get_arena_matchup` | Read | No | Random pairwise matchup. |
| `vote_arena` | Write | Yes | Cast arena vote after confirmation. |
| `list_experiments` | Read | No | Browse experiments, optionally by hypothesis. |
| `get_experiment` | Read | No | Experiment detail and versions. |
| `submit_experiment` | Write | Yes | Submit planned/running/completed experiment. |
| `update_experiment` | Write | Yes | Update owned experiment and create a new version. |
| `get_user_profile` | Read | Optional | User profile, stats, hypotheses, stars. |
| `update_my_profile` | Write | Yes | Update the signed-in user's profile. |

## Prompts and resources

| Name | Type | Purpose |
| --- | --- | --- |
| `formulate-hypothesis` | Prompt | Turn an idea into a testable hypothesis; submit after explicit confirmation or generate URL. |
| `co-ideate` | Prompt | Brainstorm research directions using existing hypotheses/questions. |
| `review-arena` | Prompt | Guide matchup judging with `get_arena_matchup` and `vote_arena`. |
| `design-experiment` | Prompt | Plan and submit/update experiments after confirmation. |
| `openexperiments://guide` | Resource | Platform/MCP guide and full tool summary. |
| `openexperiments://hypothesis/{id}` | Resource template | Fetch a hypothesis as markdown. |

## Setup

```bash
cd mcp-server
npm install
npm run build
```

Environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `OPENEXPERIMENTS_API_URL` | `https://openexperiments.pages.dev` | App API origin. Use `http://localhost:3000` for local dev. |
| `OPENEXPERIMENTS_SITE_URL` | Same as API URL | Site links emitted in tool output. |
| `OPENEXPERIMENTS_TOKEN` | unset | Personal access token from `/settings/mcp` for authenticated tools. |

Create a token at `<site>/settings/mcp`, then set `OPENEXPERIMENTS_TOKEN` in your MCP client config.

### Claude Code

```bash
OPENEXPERIMENTS_TOKEN=... bash configure-claude-code.sh
```

Or manually:

```bash
claude mcp add openexperiments node /absolute/path/to/mcp-server/dist/index.js
```

Add env vars in Claude Code settings if needed:

```json
{
  "mcpServers": {
    "openexperiments": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "OPENEXPERIMENTS_API_URL": "http://localhost:3000",
        "OPENEXPERIMENTS_SITE_URL": "http://localhost:3000",
        "OPENEXPERIMENTS_TOKEN": "oe_pat_..."
      }
    }
  }
}
```

### Claude Desktop

Run:

```bash
OPENEXPERIMENTS_TOKEN=... bash configure-claude-desktop.sh
```

Or add this to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "openexperiments": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/dist/index.js"],
      "env": {
        "OPENEXPERIMENTS_API_URL": "https://openexperiments.pages.dev",
        "OPENEXPERIMENTS_SITE_URL": "https://openexperiments.pages.dev",
        "OPENEXPERIMENTS_TOKEN": "oe_pat_..."
      }
    }
  }
}
```

### Cursor / other stdio clients

Use command `node` with args `[/absolute/path/to/mcp-server/dist/index.js]` and the same environment variables above.

### Remote connector

The remote Cloudflare Worker imports `@openexperiments/mcp-server/register`. See `../mcp-worker/README.md` for OAuth connector setup.

## Testing

```bash
npm run build
npm test
```

The test suite uses a local mock HTTP server and in-memory MCP transports; it has no external network dependency.

Live smoke against a running app:

```bash
OPENEXPERIMENTS_API_URL=http://localhost:3000 npm run smoke
```

## v1.2.0 changelog

- Added full website MCP coverage: account, comments, stars, arena matchup/vote, experiment submit/update, dataset submit, profile read/update.
- Migrated tools to `server.registerTool` with MCP annotations.
- Added typed API responses (`src/api-types.ts`) and removed `any` from MCP source.
- Added central authenticated API helper with timeouts and user-friendly error mapping.
- Added prompt updates, `review-arena`, `design-experiment`, and hypothesis resource template.
- Added automated mock-server tests and live smoke script.
