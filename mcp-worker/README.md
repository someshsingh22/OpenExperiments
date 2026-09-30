# OpenExperiments Remote MCP Worker

Cloudflare Worker that exposes OpenExperiments as a remote MCP connector for Claude.ai, ChatGPT, Claude Code, and other MCP clients.

## Architecture

- `@cloudflare/workers-oauth-provider` implements OAuth 2.1 discovery, dynamic client registration, token issuance, and token validation.
- `agents` `McpAgent` runs the MCP server in a Durable Object and serves both Streamable HTTP (`/mcp`) and legacy SSE (`/sse`).
- Tool, prompt, and resource definitions are imported from `@openexperiments/mcp-server/register`, built from `../mcp-server/dist`.
- The worker delegates user login to the Next.js app, exchanges the app one-time code for an OpenExperiments bearer token, and stores that token in OAuth grant props.

## OAuth flow

```text
MCP client
  -> GET /.well-known/oauth-authorization-server
  -> POST /register
  -> GET /authorize?client_id=...&redirect_uri=...&state=client-state&code_challenge=...
Worker
  -> validates the OAuth request with workers-oauth-provider
  -> stores request in OAUTH_KV under a random nonce
  -> shows consent page with CSRF protection
User approves
  -> POST /authorize
Worker
  -> redirects to {OPENEXPERIMENTS_API_URL}/api/auth/mcp/authorize?redirect_uri={worker}/callback&state={nonce}
OpenExperiments app
  -> requires app login, then redirects to {worker}/callback?code=...&state={nonce}
Worker
  -> verifies nonce cookie + KV state
  -> POSTs code to /api/auth/mcp/token with X-MCP-Secret
  -> completes OAuth authorization and stores { userId, appToken } in grant props
MCP client
  -> calls /mcp or /sse with the issued bearer token
```

## Local development

1. Run the OpenExperiments app on `http://localhost:3000` with matching `MCP_SERVER_SECRET` and `MCP_WORKER_URL=http://localhost:8787`.
2. Create local worker vars:

   ```bash
   cd mcp-worker
   cp .dev.vars.example .dev.vars
   ```

3. Start the worker:

   ```bash
   npm run dev -- --port 8787
   ```

Useful local endpoints:

- Landing page: `http://localhost:8787/`
- Health: `http://localhost:8787/health`
- Streamable HTTP MCP: `http://localhost:8787/mcp`
- Legacy SSE MCP: `http://localhost:8787/sse`

## Deployment

1. Create the OAuth KV namespace from this directory and copy the generated ID into `wrangler.jsonc`:

   ```bash
   cd mcp-worker
   npx wrangler kv namespace create OAUTH_KV
   ```

2. Set worker secrets:

   ```bash
   npx wrangler secret put MCP_SERVER_SECRET
   ```

3. Configure worker vars in `wrangler.jsonc`:

   - `OPENEXPERIMENTS_API_URL` — app API origin, e.g. `https://openexperiments.pages.dev`
   - `OPENEXPERIMENTS_SITE_URL` — public website origin; defaults in code to the API URL if omitted

4. Configure matching app environment:

   - `MCP_WORKER_URL=https://<worker-origin>`
   - `NEXT_PUBLIC_MCP_WORKER_URL=https://<worker-origin>`
   - `MCP_SERVER_SECRET=<same secret as worker>`

5. Deploy:

   ```bash
   npm run deploy
   ```

`predev` and `predeploy` build `../mcp-server` first so the worker imports the latest shared `dist/` module.

## Adding the connector

- Claude Code:

  ```bash
  claude mcp add --transport http openexperiments https://<worker-origin>/mcp
  ```

- Claude.ai / ChatGPT: add a custom remote MCP connector URL using `https://<worker-origin>/mcp`. If a client only supports SSE, use `https://<worker-origin>/sse`.

## Security notes

- OAuth state is an unguessable nonce stored server-side in KV for 10 minutes and bound to a `__Host-` HttpOnly cookie.
- The consent screen HTML escapes all dynamic client values, uses a strict CSP, and denies framing.
- Approval POSTs require a CSRF token stored in KV and in a `__Host-` cookie.
- App code exchange is server-to-server only and requires `X-MCP-Secret`.
- Upstream token-exchange error bodies are not reflected to users.
- Missing `MCP_SERVER_SECRET` fails closed.
