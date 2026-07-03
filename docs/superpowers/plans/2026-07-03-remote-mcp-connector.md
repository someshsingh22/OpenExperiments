# Remote MCP Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a publicly hosted, OAuth-authenticated remote MCP server so OpenExperiments can be added to Claude.ai / ChatGPT as a connector by URL.

**Architecture:** A new Cloudflare Worker (`mcp-worker/`) speaks MCP over HTTP (SSE + Streamable HTTP) via Cloudflare's `agents` `McpAgent`, with `@cloudflare/workers-oauth-provider` as an OAuth 2.1 server that delegates login to the app's existing Google sign-in. Tool/prompt/resource definitions are extracted into a runtime-neutral shared module imported by both the existing stdio server and the new Worker. Public tools work anonymously; user-scoped tools forward a per-user bearer token to the app's `/api/*` routes.

**Tech Stack:** Cloudflare Workers + Durable Objects + KV, `@cloudflare/workers-oauth-provider`, `agents` SDK, `@modelcontextprotocol/sdk`, `zod`, Next.js 15 (edge), Drizzle ORM, D1.

## Global Constraints

- Every non-static app page/route must have `export const runtime = "edge"`.
- App code: Web APIs only, no Node built-ins. `null` from DB → coerce with `?? undefined`. No `any` in new app code, no suppressed TS errors.
- App DB access via Drizzle only. Schema changes → `npx drizzle-kit generate` (never hand-edit `drizzle/migrations/`).
- App runtime env comes from `getRequestContext().env`, not `process.env`.
- Use `npm run wrangler -- <cmd>` in the app repo (not `npx wrangler`).
- The shared tool module (`mcp-server/src/register.ts`) must be runtime-neutral: no `process`, no `dotenv`, no Node built-ins — only `fetch`, `zod`, and the MCP SDK.
- The stdio server (`mcp-server/src/index.ts`) must keep working unchanged for Claude Code / local use.
- Commit after every task.

## File Structure

**App repo (root):**

- Modify `src/db/schema.ts` — add `mcpAuthCodes`, `mcpTokens` tables.
- Create `drizzle/migrations/0005_*.sql` — generated migration.
- Modify `src/env.d.ts` — add `MCP_SERVER_SECRET`.
- Create `src/lib/mcp-tokens.ts` — auth-code + token helpers.
- Modify `src/lib/auth.ts` — `getSession()` gains a bearer-token path.
- Create `src/app/api/auth/mcp/authorize/route.ts` — mint one-time code for a logged-in user.
- Create `src/app/api/auth/mcp/token/route.ts` — server-to-server code→token exchange.
- Modify `src/app/api/hypotheses/route.ts` — add `mine=true` filter.

**Shared module (`mcp-server/`):**

- Create `mcp-server/src/register.ts` — `registerOpenExperiments(server, opts)` (all tools/prompts/resource, runtime-neutral).
- Modify `mcp-server/src/index.ts` — thin stdio entry calling `registerOpenExperiments`.
- Modify `mcp-server/package.json` — add `./register` subpath export.

**Worker (`mcp-worker/`):**

- Create `mcp-worker/package.json`, `mcp-worker/wrangler.jsonc`, `mcp-worker/tsconfig.json`.
- Create `mcp-worker/src/index.ts` — `OAuthProvider` wiring + `McpAgent` subclass.
- Create `mcp-worker/src/app-handler.ts` — `/authorize` + `/callback` delegating to the app login.
- Create `mcp-worker/.dev.vars.example`, `mcp-worker/README.md`.

---

## Task 1: App-side auth tables + migration

**Files:**

- Modify: `src/db/schema.ts`
- Modify: `src/env.d.ts`
- Create: `drizzle/migrations/0005_mcp_auth.sql` (generated)

**Interfaces:**

- Produces: Drizzle tables `mcpAuthCodes { code (pk), userId, expiresAt, createdAt }` and `mcpTokens { token (pk), userId, label, expiresAt (nullable), createdAt, lastUsedAt (nullable) }`; env field `MCP_SERVER_SECRET: string`.

- [ ] **Step 1: Add the two tables to the schema**

In `src/db/schema.ts`, after the `sessions` table block, add:

```ts
export const mcpAuthCodes = sqliteTable(
  "mcp_auth_codes",
  {
    code: text("code").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [index("idx_mcp_auth_codes_expires_at").on(table.expiresAt)],
);

export const mcpTokens = sqliteTable(
  "mcp_tokens",
  {
    token: text("token").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    label: text("label"),
    expiresAt: integer("expires_at"),
    createdAt: integer("created_at").notNull(),
    lastUsedAt: integer("last_used_at"),
  },
  (table) => [index("idx_mcp_tokens_user_id").on(table.userId)],
);
```

- [ ] **Step 2: Add the env field**

In `src/env.d.ts`, add inside `interface CloudflareEnv`:

```ts
MCP_SERVER_SECRET: string;
```

- [ ] **Step 3: Generate the migration**

Run: `npx drizzle-kit generate`
Expected: a new file `drizzle/migrations/0005_*.sql` is created containing `CREATE TABLE \`mcp_auth_codes\``and`CREATE TABLE \`mcp_tokens\``.

- [ ] **Step 4: Apply the migration locally and verify**

Run: `npm run wrangler -- d1 migrations apply openexperiments-db --local`
Then run: `npm run wrangler -- d1 execute openexperiments-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'mcp_%';"`
Expected: rows `mcp_auth_codes` and `mcp_tokens`.

- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/env.d.ts drizzle/migrations/
git commit -m "feat(db): add mcp_auth_codes and mcp_tokens tables"
```

---

## Task 2: Token helper library

**Files:**

- Create: `src/lib/mcp-tokens.ts`

**Interfaces:**

- Consumes: `getDB()` from `@/db`, tables from Task 1.
- Produces:
  - `createAuthCode(db, userId: string): Promise<string>`
  - `consumeAuthCode(db, code: string): Promise<string | null>` (returns userId, single-use)
  - `createMcpToken(db, userId: string, label?: string): Promise<string>`
  - `resolveMcpToken(db, token: string): Promise<string | null>` (returns userId)
  - `type DB = ReturnType<typeof getDB>`

- [ ] **Step 1: Write the helper module**

Create `src/lib/mcp-tokens.ts`:

```ts
import { getDB } from "@/db";
import { mcpAuthCodes, mcpTokens } from "@/db/schema";
import { eq, and, gt } from "drizzle-orm";

export type DB = ReturnType<typeof getDB>;

const AUTH_CODE_TTL_SECONDS = 600; // 10 minutes

/** Mint a single-use authorization code bound to a user. */
export async function createAuthCode(db: DB, userId: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const code = crypto.randomUUID() + crypto.randomUUID();
  await db.insert(mcpAuthCodes).values({
    code,
    userId,
    expiresAt: now + AUTH_CODE_TTL_SECONDS,
    createdAt: now,
  });
  return code;
}

/** Consume a code once: returns the userId if valid+unexpired, else null. */
export async function consumeAuthCode(db: DB, code: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({ userId: mcpAuthCodes.userId })
    .from(mcpAuthCodes)
    .where(and(eq(mcpAuthCodes.code, code), gt(mcpAuthCodes.expiresAt, now)))
    .limit(1);
  await db.delete(mcpAuthCodes).where(eq(mcpAuthCodes.code, code));
  return rows.length > 0 ? rows[0].userId : null;
}

/** Create a long-lived MCP access token bound to a user. */
export async function createMcpToken(db: DB, userId: string, label?: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const token = crypto.randomUUID() + crypto.randomUUID();
  await db.insert(mcpTokens).values({
    token,
    userId,
    label: label ?? undefined,
    expiresAt: undefined,
    createdAt: now,
    lastUsedAt: undefined,
  });
  return token;
}

/** Resolve a bearer token to a userId (null if unknown/expired). */
export async function resolveMcpToken(db: DB, token: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const rows = await db
    .select({ userId: mcpTokens.userId, expiresAt: mcpTokens.expiresAt })
    .from(mcpTokens)
    .where(eq(mcpTokens.token, token))
    .limit(1);
  if (rows.length === 0) return null;
  if (rows[0].expiresAt != null && rows[0].expiresAt <= now) return null;
  await db.update(mcpTokens).set({ lastUsedAt: now }).where(eq(mcpTokens.token, token));
  return rows[0].userId;
}
```

- [ ] **Step 2: Type-check**

Run: `npm run lint`
Expected: no errors in `src/lib/mcp-tokens.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/mcp-tokens.ts
git commit -m "feat(auth): add mcp token + auth-code helpers"
```

---

## Task 3: Bearer-token path in getSession

**Files:**

- Modify: `src/lib/auth.ts`

**Interfaces:**

- Consumes: `resolveMcpToken` from Task 2.
- Produces: `getSession(request)` resolves a user from `Authorization: Bearer <token>` when present, otherwise falls back to the `session` cookie (unchanged behavior).

- [ ] **Step 1: Add the bearer branch**

In `src/lib/auth.ts`, replace the body of `getSession` up to the cookie parse with a bearer check first. The full updated function:

```ts
export async function getSession(request: Request): Promise<SessionUser | null> {
  const db = getDB();

  // 1. Bearer token (MCP connector callers)
  const authHeader = request.headers.get("authorization") || "";
  const bearer = authHeader.match(/^Bearer\s+(.+)$/i);
  if (bearer) {
    const { resolveMcpToken } = await import("@/lib/mcp-tokens");
    const userId = await resolveMcpToken(db, bearer[1]);
    if (userId) {
      const urows = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          avatarUrl: users.avatarUrl,
          profileCompleted: users.profileCompleted,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      if (urows.length > 0) {
        return {
          id: urows[0].id,
          email: urows[0].email,
          name: urows[0].name,
          avatarUrl: urows[0].avatarUrl,
          profileCompleted: urows[0].profileCompleted === 1,
        };
      }
    }
    // fall through to cookie if token invalid
  }

  // 2. Session cookie (browser callers) — existing behavior
  const cookie = request.headers.get("cookie") || "";
  const match = cookie.match(/session=([^;]+)/);
  if (!match) return null;

  const sessionId = match[1];
  const now = Math.floor(Date.now() / 1000);

  const rows = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      profileCompleted: users.profileCompleted,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, now)))
    .limit(1);

  if (rows.length === 0) return null;

  return {
    id: rows[0].userId,
    email: rows[0].email,
    name: rows[0].name,
    avatarUrl: rows[0].avatarUrl,
    profileCompleted: rows[0].profileCompleted === 1,
  };
}
```

- [ ] **Step 2: Verify against a live token**

Start the app: `npm run dev` (separate terminal). Then mint a token directly in local D1 and call `/api/auth/me`:

```bash
npm run wrangler -- d1 execute openexperiments-db --local --command \
  "INSERT INTO mcp_tokens (token,user_id,created_at) SELECT 'test-token-123', id, 0 FROM users LIMIT 1;"
curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer test-token-123"
```

Expected: JSON with a non-null `user` object (the first user), proving bearer auth resolves.

- [ ] **Step 3: Verify a bad token falls through to anonymous**

Run: `curl -s http://localhost:3000/api/auth/me -H "Authorization: Bearer nope"`
Expected: `{"user":null}` (no crash).

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth.ts
git commit -m "feat(auth): resolve session from Bearer MCP token"
```

---

## Task 4: `/api/auth/mcp/authorize` route

**Files:**

- Create: `src/app/api/auth/mcp/authorize/route.ts`

**Interfaces:**

- Consumes: `getSession` (Task 3), `createAuthCode` (Task 2), `getDB`, `getRequestContext().env`.
- Produces: `GET /api/auth/mcp/authorize?redirect_uri=<url>&state=<s>` → if logged in, `302` to `redirect_uri?code=<code>&state=<s>`; if not, `302` to `/api/auth/google?...` chained back to itself. `redirect_uri` must be an `https://` URL or `http://localhost`.

- [ ] **Step 1: Write the route**

Create `src/app/api/auth/mcp/authorize/route.ts`:

```ts
export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/db";
import { getSession } from "@/lib/auth";
import { createAuthCode } from "@/lib/mcp-tokens";

function isAllowedRedirect(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === "https:") return true;
    if (u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1"))
      return true;
    return false;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  const { env } = getRequestContext();
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri") || "";
  const state = url.searchParams.get("state") || "";

  if (!isAllowedRedirect(redirectUri)) {
    return Response.json({ error: "invalid redirect_uri" }, { status: 400 });
  }

  const user = await getSession(request);

  // Not logged in → send through Google login, returning to this endpoint.
  if (!user) {
    const returnTo = `${env.APP_URL}/api/auth/mcp/authorize?redirect_uri=${encodeURIComponent(
      redirectUri,
    )}&state=${encodeURIComponent(state)}`;
    const loginUrl = `${env.APP_URL}/api/auth/google?returnTo=${encodeURIComponent(returnTo)}`;
    return new Response(null, { status: 302, headers: { Location: loginUrl } });
  }

  // Logged in → mint a one-time code and bounce back to the MCP worker.
  const db = getDB();
  const code = await createAuthCode(db, user.id);
  const dest = new URL(redirectUri);
  dest.searchParams.set("code", code);
  if (state) dest.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: { Location: dest.toString() } });
}
```

- [ ] **Step 2: Confirm the Google login honors `returnTo`**

Read `src/app/api/auth/google/route.ts` and `src/app/api/auth/google/callback/route.ts`. If `returnTo` is NOT already threaded through the OAuth `state`, add it: in `google/route.ts` accept `returnTo` from the query and store it (e.g. append to the `oauth_state` cookie value as `state|returnTo` or a separate `login_return_to` cookie); in the callback, after the session cookie is set, redirect to that `returnTo` when present (default to `/` otherwise).

Concrete minimal change in `google/route.ts` (add near the top of `GET`, after reading the request):

```ts
const reqUrl = new URL(request.url); // add `request: Request` param to GET
const returnTo = reqUrl.searchParams.get("returnTo") || "";
```

and append a cookie:

```ts
if (returnTo) {
  headers.append(
    "Set-Cookie",
    `login_return_to=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`,
  );
}
```

In `google/callback/route.ts`, after the session cookie is appended, read the `login_return_to` cookie and set `Location` to it (falling back to the existing default redirect), and clear the cookie.

- [ ] **Step 3: Verify the logged-in path issues a code**

With `npm run dev` running and a valid `session` cookie for a local user (log in via the UI, copy the cookie), run:

```bash
curl -s -i "http://localhost:3000/api/auth/mcp/authorize?redirect_uri=http://localhost:8787/callback&state=xyz" \
  -H "Cookie: session=<your-session-id>"
```

Expected: `302` with `Location: http://localhost:8787/callback?code=...&state=xyz`.

- [ ] **Step 4: Verify the logged-out path redirects to Google login**

Run the same curl without the `Cookie` header.
Expected: `302` with `Location` pointing at `/api/auth/google?returnTo=...`.

- [ ] **Step 5: Verify a bad redirect_uri is rejected**

Run: `curl -s -i "http://localhost:3000/api/auth/mcp/authorize?redirect_uri=ftp://evil"`
Expected: `400` with `{"error":"invalid redirect_uri"}`.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/auth/mcp/authorize/route.ts src/app/api/auth/google/
git commit -m "feat(auth): mcp authorize endpoint + returnTo through google login"
```

---

## Task 5: `/api/auth/mcp/token` route (code→token exchange)

**Files:**

- Create: `src/app/api/auth/mcp/token/route.ts`

**Interfaces:**

- Consumes: `consumeAuthCode`, `createMcpToken` (Task 2), `getRequestContext().env.MCP_SERVER_SECRET`.
- Produces: `POST /api/auth/mcp/token` with header `X-MCP-Secret: <secret>` and JSON `{ code }` → `{ token, userId }` on success; `403` bad secret; `400` invalid/expired code.

- [ ] **Step 1: Write the route**

Create `src/app/api/auth/mcp/token/route.ts`:

```ts
export const runtime = "edge";

import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/db";
import { consumeAuthCode, createMcpToken } from "@/lib/mcp-tokens";

export async function POST(request: Request) {
  const { env } = getRequestContext();

  const secret = request.headers.get("x-mcp-secret") || "";
  if (!env.MCP_SERVER_SECRET || secret !== env.MCP_SERVER_SECRET) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let body: { code?: string };
  try {
    body = (await request.json()) as { code?: string };
  } catch {
    return Response.json({ error: "invalid body" }, { status: 400 });
  }
  const code = body.code;
  if (!code) return Response.json({ error: "missing code" }, { status: 400 });

  const db = getDB();
  const userId = await consumeAuthCode(db, code);
  if (!userId) return Response.json({ error: "invalid or expired code" }, { status: 400 });

  const token = await createMcpToken(db, userId, "mcp-connector");
  return Response.json({ token, userId });
}
```

- [ ] **Step 2: Set a local secret**

Append to the app's `.env` (gitignored): `MCP_SERVER_SECRET=dev-secret-123`. Restart `npm run dev`.

- [ ] **Step 3: Verify a full code→token round-trip**

Mint a code for a user, then exchange it:

```bash
npm run wrangler -- d1 execute openexperiments-db --local --command \
  "INSERT INTO mcp_auth_codes (code,user_id,expires_at,created_at) SELECT 'code-abc', id, 9999999999, 0 FROM users LIMIT 1;"
curl -s -X POST http://localhost:3000/api/auth/mcp/token \
  -H "X-MCP-Secret: dev-secret-123" -H "Content-Type: application/json" \
  -d '{"code":"code-abc"}'
```

Expected: `{"token":"...","userId":"..."}`. Re-running the same curl returns `400` (code is single-use).

- [ ] **Step 4: Verify secret enforcement**

Run the curl with a wrong `X-MCP-Secret`.
Expected: `403`.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth/mcp/token/route.ts
git commit -m "feat(auth): mcp code-to-token exchange endpoint"
```

---

## Task 6: `mine=true` filter on hypotheses list

**Files:**

- Modify: `src/app/api/hypotheses/route.ts`

**Interfaces:**

- Consumes: existing `viewer` (from `getSession`) and `conditions: SQL[]` in the `GET` handler.
- Produces: `GET /api/hypotheses?mine=true` restricted to `submittedBy === viewer.id`; ignored (returns nothing extra) when unauthenticated.

- [ ] **Step 1: Add the filter**

In `src/app/api/hypotheses/route.ts` `GET`, after the existing `const domain = ...` / `status` / etc. reads, add:

```ts
const mine = url.searchParams.get("mine");
```

Then, alongside the other `conditions.push(...)` lines (after the `domain` condition), add:

```ts
if (mine === "true") {
  if (!viewer) {
    return Response.json({ data: [], total: 0 });
  }
  conditions.push(eq(hypotheses.submittedBy, viewer.id));
}
```

(`eq` and `hypotheses` are already imported in this file.)

- [ ] **Step 2: Verify with a bearer token**

Using the token minted in Task 5 (call it `$TOK`):

```bash
curl -s "http://localhost:3000/api/hypotheses?mine=true" -H "Authorization: Bearer $TOK" | head -c 400
```

Expected: `{"data":[...],"total":N}` containing only hypotheses whose `submittedBy` is that user (empty array is valid if they submitted none).

- [ ] **Step 3: Verify unauthenticated returns empty**

Run: `curl -s "http://localhost:3000/api/hypotheses?mine=true"`
Expected: `{"data":[],"total":0}`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/hypotheses/route.ts
git commit -m "feat(api): support mine=true filter on hypotheses list"
```

---

## Task 7: Extract the shared tool module

**Files:**

- Create: `mcp-server/src/register.ts`
- Modify: `mcp-server/src/index.ts`
- Modify: `mcp-server/package.json`

**Interfaces:**

- Produces:
  - `interface RegisterOptions { apiUrl: string; siteUrl: string; getAuthToken?: () => string | undefined }`
  - `function registerOpenExperiments(server: McpServer, opts: RegisterOptions): void`
  - package subpath export `@openexperiments/mcp-server/register` → `dist/register.js` (+ types).
- Consumes: nothing new.

- [ ] **Step 1: Create `register.ts` with a token-aware `api()` helper**

Create `mcp-server/src/register.ts`. Move the entire body of tool/prompt/resource registration from `index.ts` into this function. The header + `api()` helper:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export interface RegisterOptions {
  apiUrl: string;
  siteUrl: string;
  /** Returns the current caller's app bearer token, if authenticated. */
  getAuthToken?: () => string | undefined;
}

export function registerOpenExperiments(server: McpServer, opts: RegisterOptions): void {
  const API_URL = opts.apiUrl;
  const SITE_URL = opts.siteUrl;

  async function api<T>(path: string): Promise<T> {
    const headers: Record<string, string> = {};
    const token = opts.getAuthToken?.();
    if (token) headers["Authorization"] = `Bearer ${token}`;
    let res: Response;
    try {
      res = await fetch(`${API_URL}${path}`, { headers });
    } catch (err) {
      throw new Error(
        `Cannot reach OpenExperiments API at ${API_URL}.\n${
          err instanceof Error ? err.message : err
        }`,
      );
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`API ${res.status} on ${path}: ${body.slice(0, 300)}`);
    }
    return res.json() as Promise<T>;
  }

  // ---- move every server.tool(...), server.prompt(...), server.resource(...)
  //      block from index.ts to here, verbatim, so they close over api/SITE_URL ----
}
```

Then move all `server.tool` / `server.prompt` / `server.resource` blocks (the full set from the current `index.ts`, including `list_problem_statements`, `search_hypotheses`, `get_hypothesis`, `list_datasets`, `get_dataset`, `get_arena_rankings`, `list_experiments`, `get_experiment`, `platform_overview`, `generate_submission_url`, the `formulate-hypothesis` and `co-ideate` prompts, and the `platform-guide` resource) inside `registerOpenExperiments`, unchanged.

- [ ] **Step 2: Reduce `index.ts` to a thin stdio entry**

Replace `mcp-server/src/index.ts` with:

```ts
#!/usr/bin/env node

import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerOpenExperiments } from "./register.js";

config();

const apiUrl = process.env.OPENEXPERIMENTS_API_URL || "https://openexperiments.pages.dev";
const siteUrl = process.env.OPENEXPERIMENTS_SITE_URL || apiUrl;

const server = new McpServer({ name: "openexperiments", version: "1.0.0" });
registerOpenExperiments(server, { apiUrl, siteUrl });

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Add the subpath export**

In `mcp-server/package.json`, add an `exports` map (keep the existing `bin`):

```json
  "exports": {
    ".": "./dist/index.js",
    "./register": {
      "types": "./dist/register.d.ts",
      "default": "./dist/register.js"
    }
  },
```

- [ ] **Step 4: Build and smoke-test the stdio server**

Run: `cd mcp-server && npm run build`
Expected: compiles with no errors; `dist/register.js`, `dist/register.d.ts`, `dist/index.js` exist.

Then verify the stdio server still lists tools:

```bash
cd mcp-server && printf '%s\n' \
  '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"t","version":"1"}}}' \
  '{"jsonrpc":"2.0","method":"notifications/initialized"}' \
  '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | OPENEXPERIMENTS_API_URL=https://openexperiments.pages.dev node dist/index.js
```

Expected: JSON responses; the `tools/list` result lists all 10 tools.

- [ ] **Step 5: Commit**

```bash
git add mcp-server/src/register.ts mcp-server/src/index.ts mcp-server/package.json
git commit -m "refactor(mcp): extract runtime-neutral registerOpenExperiments shared module"
```

---

## Task 8: Scaffold the Worker package from the official template

**Files:**

- Create: `mcp-worker/` (from template), then trim.
- Create/Modify: `mcp-worker/wrangler.jsonc`, `mcp-worker/package.json`, `mcp-worker/tsconfig.json`, `mcp-worker/.dev.vars.example`.

**Interfaces:**

- Produces: a deployable Worker skeleton with `OAuthProvider` + a `McpAgent` Durable Object, KV binding `OAUTH_KV`, and a local dev command. Depends on `@openexperiments/mcp-server` via `file:../mcp-server`.

- [ ] **Step 1: Scaffold from Cloudflare's authed remote-MCP template**

From the repo root, run:

```bash
npm create cloudflare@latest -- mcp-worker \
  --template=cloudflare/ai/demos/remote-mcp-github-oauth \
  --no-deploy --no-git
```

(This template ships the exact `OAuthProvider` + `McpAgent` + third-party-OAuth wiring we adapt. If the create CLI prompts, decline deploy and git.)

Expected: a `mcp-worker/` directory with `src/index.ts`, `src/app.ts` (or `github-handler.ts`), `wrangler.jsonc`, `package.json`, `tsconfig.json`.

- [ ] **Step 2: Add the shared module dependency + a KV namespace**

In `mcp-worker/package.json`, add to `dependencies`:

```json
    "@openexperiments/mcp-server": "file:../mcp-server"
```

Ensure `@modelcontextprotocol/sdk`, `zod`, `agents`, and `@cloudflare/workers-oauth-provider` are present in `dependencies` (the template includes the last three; add the first two if missing, matching the versions in `mcp-server/package.json`).

Create the KV namespace:

```bash
cd mcp-worker && npx wrangler kv namespace create OAUTH_KV
```

Expected: prints an `id`. Put it in `wrangler.jsonc` under `kv_namespaces` with `binding: "OAUTH_KV"`.

- [ ] **Step 3: Set the Worker name + vars in `wrangler.jsonc`**

Set `"name": "openexperiments-mcp"`. Ensure the Durable Object binding for the MCP agent class and its `migrations` entry exist (the template provides these; keep the class name used in `src/index.ts`). Add a plain var for the app URL:

```jsonc
  "vars": { "OPENEXPERIMENTS_API_URL": "https://openexperiments.pages.dev" }
```

- [ ] **Step 4: Create `.dev.vars.example`**

Create `mcp-worker/.dev.vars.example`:

```
# Shared secret — must match the app's MCP_SERVER_SECRET
MCP_SERVER_SECRET=dev-secret-123
# App base URL used for OAuth delegation (local: http://localhost:3000)
OPENEXPERIMENTS_API_URL=http://localhost:3000
```

Copy it to `.dev.vars` for local dev (gitignored by the template).

- [ ] **Step 5: Install and confirm it boots**

Run: `cd mcp-server && npm run build && cd ../mcp-worker && npm install && npx wrangler dev`
Expected: `wrangler dev` starts and serves on `http://localhost:8787` with no build errors. Stop it after confirming (Ctrl-C).

- [ ] **Step 6: Commit**

```bash
git add mcp-worker/ && git status
git commit -m "chore(mcp-worker): scaffold cloudflare remote-mcp worker from template"
```

(Do not commit `mcp-worker/.dev.vars`; confirm it is gitignored.)

---

## Task 9: Register OpenExperiments tools in the McpAgent

**Files:**

- Modify: `mcp-worker/src/index.ts` (the `McpAgent` subclass `init()`).

**Interfaces:**

- Consumes: `registerOpenExperiments` from `@openexperiments/mcp-server/register`; `this.props.appToken` (set in Task 10); `this.env.OPENEXPERIMENTS_API_URL`.
- Produces: the agent exposes all OpenExperiments tools/prompts/resource; user-scoped calls forward `props.appToken`.

- [ ] **Step 1: Define the props type and wire registration**

In `mcp-worker/src/index.ts`, set the agent's `Props` type to carry the app token and register tools in `init()`:

```ts
import { registerOpenExperiments } from "@openexperiments/mcp-server/register";

type Props = {
  userId: string;
  appToken: string;
};

// inside the McpAgent subclass:
export class OpenExperimentsMCP extends McpAgent<Env, unknown, Props> {
  server = new McpServer({ name: "openexperiments", version: "1.0.0" });

  async init() {
    const apiUrl = this.env.OPENEXPERIMENTS_API_URL;
    registerOpenExperiments(this.server, {
      apiUrl,
      siteUrl: apiUrl,
      getAuthToken: () => this.props?.appToken,
    });
  }
}
```

Keep the class name consistent with the Durable Object binding in `wrangler.jsonc` (rename the binding if you rename the class). Ensure `Env` includes `OPENEXPERIMENTS_API_URL: string`, `MCP_SERVER_SECRET: string`, `OAUTH_KV: KVNamespace`, and the OAuth provider binding — regenerate types with `npx wrangler types` if the template provides that script.

- [ ] **Step 2: Confirm anonymous tools work over MCP**

Run `npx wrangler dev` in `mcp-worker/`, then in another terminal launch the Inspector:

```bash
npx @modelcontextprotocol/inspector
```

In the Inspector UI, connect to `http://localhost:8787/sse`. For now the OAuth flow may be incomplete; use the Inspector's "skip auth"/manual mode if available, or proceed to Task 10 first and return here. Confirm `tools/list` shows all 10 tools and that `platform_overview` returns data (it hits the public API, no token needed).

- [ ] **Step 3: Commit**

```bash
git add mcp-worker/src/index.ts
git commit -m "feat(mcp-worker): register OpenExperiments tools in McpAgent"
```

---

## Task 10: OAuth handler delegating to the app login

**Files:**

- Create: `mcp-worker/src/app-handler.ts`
- Modify: `mcp-worker/src/index.ts` (use `app-handler` as `defaultHandler`)

**Interfaces:**

- Consumes: `env.OAUTH_PROVIDER` helper (`parseAuthRequest`, `completeAuthorization`), `env.OPENEXPERIMENTS_API_URL`, `env.MCP_SERVER_SECRET`.
- Produces: `GET /authorize` → redirect to app `/api/auth/mcp/authorize`; `GET /callback` → exchange code at app `/api/auth/mcp/token`, then `completeAuthorization` with `props { userId, appToken }`.

- [ ] **Step 1: Write the handler**

Create `mcp-worker/src/app-handler.ts` (Hono-style, matching the template's handler pattern; adapt imports to the template's actual `AuthRequest`/helper types):

```ts
import { Hono } from "hono";

type Env = {
  OAUTH_PROVIDER: {
    parseAuthRequest: (req: Request) => Promise<AuthRequest>;
    completeAuthorization: (opts: {
      request: AuthRequest;
      userId: string;
      metadata: Record<string, unknown>;
      scope: string[];
      props: Record<string, unknown>;
    }) => Promise<{ redirectTo: string }>;
  };
  OPENEXPERIMENTS_API_URL: string;
  MCP_SERVER_SECRET: string;
};

// Shape returned by parseAuthRequest (see @cloudflare/workers-oauth-provider types).
type AuthRequest = Parameters<Env["OAUTH_PROVIDER"]["completeAuthorization"]>[0]["request"];

const app = new Hono<{ Bindings: Env }>();

// Encode the OAuth request into `state` so we can restore it on callback.
app.get("/authorize", async (c) => {
  const oauthReq = await c.env.OAUTH_PROVIDER.parseAuthRequest(c.req.raw);
  const state = btoa(JSON.stringify(oauthReq));
  const workerOrigin = new URL(c.req.url).origin;
  const redirectUri = `${workerOrigin}/callback`;
  const dest = new URL(`${c.env.OPENEXPERIMENTS_API_URL}/api/auth/mcp/authorize`);
  dest.searchParams.set("redirect_uri", redirectUri);
  dest.searchParams.set("state", state);
  return c.redirect(dest.toString());
});

app.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return c.text("missing code/state", 400);

  const oauthReq = JSON.parse(atob(state)) as AuthRequest;

  // Exchange the one-time code for a long-lived app token.
  const res = await fetch(`${c.env.OPENEXPERIMENTS_API_URL}/api/auth/mcp/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-MCP-Secret": c.env.MCP_SERVER_SECRET },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) return c.text("token exchange failed", 400);
  const { token, userId } = (await res.json()) as { token: string; userId: string };

  const { redirectTo } = await c.env.OAUTH_PROVIDER.completeAuthorization({
    request: oauthReq,
    userId,
    metadata: {},
    scope: oauthReq.scope ?? [],
    props: { userId, appToken: token },
  });
  return c.redirect(redirectTo);
});

export default app;
```

- [ ] **Step 2: Wire it as the OAuthProvider defaultHandler**

In `mcp-worker/src/index.ts`, ensure the default export is the `OAuthProvider` with our handler:

```ts
import OAuthProvider from "@cloudflare/workers-oauth-provider";
import appHandler from "./app-handler";

export default new OAuthProvider({
  apiHandlers: {
    "/sse": OpenExperimentsMCP.serveSSE("/sse"),
    "/mcp": OpenExperimentsMCP.serve("/mcp"),
  },
  defaultHandler: appHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
});
```

(If the template's `OAuthProvider` API differs — e.g. `apiHandler` singular, or a different `defaultHandler` type — follow the template's exact signatures; the delegation logic in `app-handler.ts` is unchanged.)

- [ ] **Step 3: End-to-end local OAuth test with the Inspector**

Terminals: (a) app `npm run dev` on :3000 with `MCP_SERVER_SECRET=dev-secret-123` in `.env`; (b) `cd mcp-worker && npx wrangler dev` on :8787 with matching `.dev.vars`; (c) `npx @modelcontextprotocol/inspector`.

In the Inspector, connect to `http://localhost:8787/sse`. Expected: it triggers the OAuth flow → browser opens the app, you log in with Google → redirected back → Inspector shows "connected". Then call the `search_hypotheses` and `platform_overview` tools; expected: real data returns.

- [ ] **Step 4: Verify the auth-scoped path carries identity**

(Task 11 adds `get_my_hypotheses`; if running Task 10 before 11, instead verify identity by temporarily calling `search_hypotheses` — it works anonymously — and defer the my-hypotheses check to Task 11 Step 3.)

- [ ] **Step 5: Commit**

```bash
git add mcp-worker/src/app-handler.ts mcp-worker/src/index.ts
git commit -m "feat(mcp-worker): OAuth handler delegating to app google login"
```

---

## Task 11: Add the `get_my_hypotheses` auth-scoped tool

**Files:**

- Modify: `mcp-server/src/register.ts`

**Interfaces:**

- Consumes: `api()` + `getAuthToken` inside `registerOpenExperiments`.
- Produces: a `get_my_hypotheses` tool that calls `/api/hypotheses?mine=true`; returns a sign-in prompt when no token is present.

- [ ] **Step 1: Add the tool inside `registerOpenExperiments`**

In `mcp-server/src/register.ts`, add near the other hypothesis tools:

```ts
server.tool(
  "get_my_hypotheses",
  "List hypotheses submitted by the currently authenticated user. Requires " +
    "the caller to be signed in via the connector.",
  {},
  async () => {
    if (!opts.getAuthToken?.()) {
      return {
        content: [
          {
            type: "text" as const,
            text: "You're not signed in. Connect your OpenExperiments account in the connector settings to see your hypotheses.",
          },
        ],
      };
    }
    const { data } = await api<{ data: any[] }>("/api/hypotheses?mine=true");
    if (data.length === 0) {
      return {
        content: [{ type: "text" as const, text: "You haven't submitted any hypotheses yet." }],
      };
    }
    let text = `# Your Hypotheses (${data.length})\n\n`;
    for (const h of data) {
      const d = Array.isArray(h.domains) ? h.domains.join(", ") : h.domain;
      text += `## ${h.id} — ${h.status}\n${h.statement}\n_Domains: ${d}_\n\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
);
```

- [ ] **Step 2: Rebuild the shared module and the worker**

Run: `cd mcp-server && npm run build && cd ../mcp-worker && npx wrangler dev`
Expected: no build errors.

- [ ] **Step 3: Verify auth-scoped behavior via the Inspector**

With the full local stack running (app + worker + Inspector, authenticated as in Task 10 Step 3), call `get_my_hypotheses`.
Expected: returns _your_ hypotheses (or "haven't submitted any"). Then reconnect the Inspector without completing OAuth and call it again: expected the "not signed in" message — proving the token gate works.

- [ ] **Step 4: Commit**

```bash
git add mcp-server/src/register.ts
git commit -m "feat(mcp): add get_my_hypotheses auth-scoped tool"
```

---

## Task 12: Deploy and connect to Claude.ai

**Files:**

- Modify: `mcp-worker/README.md` (deploy + connect instructions)
- Modify: `mcp-server/README.md` (link to the remote connector)

**Interfaces:**

- Produces: a live `https://openexperiments-mcp.<account>.workers.dev` connector and matching app config.

- [ ] **Step 1: Set production secrets on the Worker**

```bash
cd mcp-worker
openssl rand -hex 32   # copy the value; use it for both sides
npx wrangler secret put MCP_SERVER_SECRET   # paste the value
```

Set `OPENEXPERIMENTS_API_URL` to `https://openexperiments.pages.dev` in `wrangler.jsonc` `vars` (already done in Task 8).

- [ ] **Step 2: Set the matching secret on the app + apply the migration**

In the app repo:

```bash
npm run wrangler -- pages secret put MCP_SERVER_SECRET   # paste the SAME value
npm run wrangler -- d1 migrations apply openexperiments-db --remote
```

Expected: migration `0005_*` applies remotely; `mcp_auth_codes` and `mcp_tokens` exist in production D1.

- [ ] **Step 3: Deploy the Worker**

```bash
cd mcp-server && npm run build && cd ../mcp-worker && npx wrangler deploy
```

Expected: prints the deployed URL `https://openexperiments-mcp.<account>.workers.dev`.

- [ ] **Step 4: Verify discovery + SSE are live**

```bash
curl -s https://openexperiments-mcp.<account>.workers.dev/.well-known/oauth-authorization-server | head -c 300
```

Expected: JSON OAuth metadata with `authorization_endpoint` and `token_endpoint`.

- [ ] **Step 5: Add as a custom connector in Claude.ai and test end-to-end**

In Claude.ai → Settings → Connectors → Add custom connector → paste `https://openexperiments-mcp.<account>.workers.dev/sse`. Complete the Google login when prompted. In a chat, ask Claude to "list open problem statements on OpenExperiments" (public tool) and "show my hypotheses" (auth-scoped).
Expected: both return real data; the second reflects your account.

- [ ] **Step 6: Document and commit**

Update `mcp-worker/README.md` with the deploy steps above and the connector URL, and add a short "Remote connector (Claude.ai / ChatGPT)" section to `mcp-server/README.md` linking to it.

```bash
git add mcp-worker/README.md mcp-server/README.md
git commit -m "docs(mcp): remote connector deploy + connect instructions"
```

---

## Notes for the implementer

- **Template API drift:** `@cloudflare/workers-oauth-provider` and `agents` evolve. Treat the code in Tasks 9–10 as the intended shape; if the scaffolded template exposes different exact names (`apiHandler` vs `apiHandlers`, handler signature, `AuthRequest` type), follow the template's real signatures — the _delegation logic_ (authorize → app, callback → exchange → completeAuthorization with `props.appToken`) is what matters and does not change.
- **Cross-package build order:** always `npm run build` in `mcp-server/` before building/deploying `mcp-worker/`, because the Worker bundles `@openexperiments/mcp-server/register` from `dist/`.
- **Secret parity:** `MCP_SERVER_SECRET` must be identical on the Worker and the app, in every environment.
