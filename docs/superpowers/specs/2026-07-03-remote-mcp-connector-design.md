# Remote MCP Connector for OpenExperiments — Design

**Date:** 2026-07-03
**Status:** Approved (design)

## Goal

Make OpenExperiments pluggable into Claude.ai and ChatGPT as a **remote MCP
connector added by URL**. The existing stdio MCP server (`mcp-server/src/index.ts`,
10 tools / 2 prompts / 1 resource) only works locally. We need a publicly hosted
HTTP MCP server. It must support **optional OAuth 2.1 authentication** so that
public discovery tools work anonymously, while user-scoped tools (e.g. "my
hypotheses") resolve the real signed-in user.

## Decisions (locked)

- **Hosting:** new Cloudflare Worker (same account/tooling as the Pages app).
- **Public by default:** all discovery/read tools work with no auth.
- **Auth:** OAuth 2.1 one-click, delegating login to the app's existing Google
  sign-in. No copy-paste tokens for the end user.
- The stdio server stays in the repo for Claude Code / local use, untouched.

## Architecture

```
Claude.ai / ChatGPT
   │  (Streamable HTTP + SSE, OAuth 2.1)
   ▼
openexperiments-mcp  (Cloudflare Worker)
   ├─ @cloudflare/workers-oauth-provider   → OAuth 2.1 server + discovery
   ├─ agents McpAgent (Durable Object)      → mounts /sse and /mcp
   │     └─ McpServer: 10 tools / 2 prompts / 1 resource (ported)
   └─ api() helper → fetch → openexperiments.pages.dev/api/*
                                   │  (Authorization: Bearer <appToken>)
                                   ▼
                     Next.js app on Cloudflare Pages + D1
```

## Components

### 1. MCP Worker (`openexperiments-mcp`)

**Packaging (locked): a new sibling `mcp-worker/` package** with its own
`package.json`, `wrangler.toml`, and `tsconfig.json` — keeping the Workers runtime,
Workers-only deps, and wrangler build fully isolated from the Node stdio package.
The tool/prompt/resource definitions are **extracted into a small shared,
runtime-neutral module** (no `process`, no Node built-ins — just `fetch`) that
both `mcp-server/` (stdio) and `mcp-worker/` (HTTP) import, so there is no
duplication and fixes land in both. Built on:

- **`@cloudflare/workers-oauth-provider`** — the OAuth 2.1 authorization server.
  Serves `.well-known/oauth-authorization-server` and
  `.well-known/oauth-protected-resource` discovery, RFC 7591 dynamic client
  registration, `/authorize`, `/token`, PKCE, and token validation. This is what
  Claude.ai and ChatGPT connector UIs expect.
- **`agents` SDK `McpAgent`** (a Durable Object) — mounts the MCP endpoint at
  `/sse` and `/mcp`, wrapping the MCP SDK `McpServer`. Handles the SSE /
  Streamable-HTTP handshake, protocol versioning, and session hibernation.
- The **same 10 tools / 2 prompts / 1 resource**, registered from the shared
  module (extracted from `mcp-server/src/index.ts`):
  - The shared module takes the API base URL + an optional per-request `appToken`
    as parameters (no `process.env`, no Node built-ins).
  - The `api()` helper forwards the caller's `appToken` as
    `Authorization: Bearer <token>` when present.
  - stdio (`mcp-server/`) passes `process.env` + no token; the Worker passes
    `env` + the authenticated grant token.

The authenticated user's `{ userId, appToken }` is stored in the OAuth grant
`props` by `workers-oauth-provider` and read inside tool handlers.

### 2. App-side additions (Next.js repo, small and non-breaking)

- **`getSession()` gains a bearer path.** In `src/lib/auth.ts`, before falling
  back to the `session` cookie, check `Authorization: Bearer <token>`; if present,
  look it up in `mcp_tokens` and resolve the user the same way. Every existing
  route calls `getSession()` unchanged, so they all transparently start accepting
  MCP callers.
- **`GET /api/auth/mcp/authorize`** (edge) — requires an app session (cookie). If
  the user is not logged in, the normal Google sign-in runs first (standard app
  redirect behavior). Once authenticated, mints a one-time code bound to `userId`
  (row in `mcp_auth_codes`, short TTL), then `302`-redirects back to the Worker's
  `redirect_uri` with `?code=...&state=...`.
- **`POST /api/auth/mcp/token`** (edge) — server-to-server. Guarded by a shared
  `MCP_SERVER_SECRET` header. Exchanges a valid, unexpired one-time code for a
  long-lived MCP token (row in `mcp_tokens`, bound to `userId`), and deletes the
  code. Returns `{ token, userId }`.
- **New D1 tables** via a Drizzle migration:
  - `mcp_auth_codes`: `code` (pk), `userId`, `expiresAt`, `createdAt`.
  - `mcp_tokens`: `token` (pk), `userId`, `label`, `expiresAt` (nullable),
    `createdAt`, `lastUsedAt` (nullable).
- **Env:** `MCP_SERVER_SECRET` (must match the Worker's secret).

### 3. Auth data flow (OAuth 2.1, delegate to app's Google login)

1. Claude/ChatGPT discovers OAuth metadata, dynamically registers a client, and
   opens the Worker `/authorize` (with PKCE).
2. Worker `/authorize` redirects the browser to the app
   `/api/auth/mcp/authorize?redirect_uri=<worker/callback>&state=<state>`.
3. App requires a session; if absent, runs Google sign-in
   (register-on-first-login), then returns to step 2's endpoint authenticated.
4. App mints a one-time code bound to `userId`, `302` → Worker `/callback?code&state`.
5. Worker `/callback` calls the app `POST /api/auth/mcp/token` with the shared
   secret, exchanging the code for a long-lived `appToken`.
6. Worker (`workers-oauth-provider`) completes its own token issuance to the MCP
   client, stashing `{ userId, appToken }` in the grant `props`.
7. On every tool call, the Worker forwards `Authorization: Bearer <appToken>` to
   `/api/*`. Public tools ignore it; user-scoped tools now resolve the real user.

**Why delegate to the app rather than straight to Google:** the app already owns
the Google client and register-on-first-login, so users remain a single source of
truth and there are no duplicate Google credentials to manage.

## Error handling

- `api()` maps upstream status: `401` → tool returns "not authenticated — connect
  your account" (no crash); `404` → "not found"; `5xx`/network → "OpenExperiments
  API unavailable, try again." Matches the stdio server's existing shape.
- OAuth: expired/invalid one-time code → app `/token` returns `400`, Worker
  surfaces a re-auth prompt. Wrong shared secret → `403`, logged.
- Auth-requiring tools with no token return a friendly "sign in via the connector
  to see your hypotheses," so anonymous use degrades gracefully.

## Testing

- **Worker local:** `wrangler dev`; drive with MCP Inspector
  (`npx @modelcontextprotocol/inspector` → `http://localhost:8787/sse`) to run the
  full OAuth handshake and exercise every tool.
- **App side:** run the two new auth routes against local D1; verify
  `getSession()` resolves both cookie and bearer; assert an expired/invalid code
  and a wrong secret are rejected.
- **End-to-end:** add the deployed URL as a custom connector in Claude.ai, confirm
  the Google login round-trip and that a user-scoped tool returns the caller's own
  hypotheses.

## Deployment

- **Worker:** `wrangler deploy` → `openexperiments-mcp.<account>.workers.dev`.
  Declare the Durable Object migration + a KV namespace (OAuth grant storage) in
  the Worker's `wrangler.toml`. Secrets: `MCP_SERVER_SECRET`,
  `OPENEXPERIMENTS_API_URL`.
- **App:** deploy as usual; run the new Drizzle migration
  (`npm run wrangler -- d1 migrations apply openexperiments-db --remote`); set a
  matching `MCP_SERVER_SECRET`.
- The stdio server (`mcp-server/src/index.ts`) is unchanged and continues to work
  for Claude Code / local use.

## Out of scope

- Personal-access-token UI (superseded by OAuth).
- Any write tools beyond what the stdio server already exposes.
- Rate limiting / quota (can be added later if abuse appears).
