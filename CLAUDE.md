# Claude Code Instructions — OpenExperiments

## Commands

```bash
npm run dev          # start dev server (localhost:3000)
npm run build        # Next.js production build
npm run deploy       # build with next-on-pages + deploy to Cloudflare Pages
npm run wrangler -- <cmd>   # wrangler CLI (use this, not npx wrangler)
npm run lint         # eslint
npm run format       # prettier write
npx drizzle-kit generate    # generate migration after schema change
```

## Stack

- Next.js 15.5.2 · App Router · **Edge Runtime only**
- Cloudflare Pages + D1 (SQLite) + Drizzle ORM
- Tailwind v4 · TypeScript strict

## Non-negotiable constraints

1. Every non-static page/route must have `export const runtime = "edge"` — the build will fail without it.
2. No Node.js built-ins — Web APIs only (`fetch`, `crypto.randomUUID()`, etc.).
3. DB access via Drizzle only. Schema changes → `npx drizzle-kit generate`.
4. `null` from DB columns → coerce to `undefined` when mapping to TS types (`?? undefined`).
5. No `any`. No suppressed TypeScript errors.
6. `npm run wrangler -- <cmd>` not `npx wrangler` (local binary path issue).

## Where things live

- `src/db/schema.ts` — Drizzle schema (tables, columns, relations)
- `src/lib/types.ts` — shared TS interfaces
- `src/lib/auth.ts` — session resolution
- `src/app/api/` — API routes (all edge)
- `drizzle/migrations/` — generated SQL migrations (never edit by hand)
- `wrangler.toml` — Cloudflare config (D1 binding `DB`, `pages_build_output_dir`)

## DB access pattern

```ts
// API route
import { getRequestContext } from "@cloudflare/next-on-pages";
import { getDB } from "@/db";
const { env } = getRequestContext();
const db = getDB(env);

// Server component (uses React cache internally)
import { getDB } from "@/db";
const db = getDB();
```

## Env vars

Runtime env comes from `getRequestContext().env`, not `process.env`. Local secrets in `.env` (gitignored — see `.env.example`).

## Pre-commit

Husky runs ESLint + Prettier on staged files. Fix errors, don't skip hooks.

## Deployment note

`npm run deploy` does not apply DB migrations. Run migrations separately:

```bash
npm run wrangler -- d1 migrations apply openexperiments-db --remote
```
