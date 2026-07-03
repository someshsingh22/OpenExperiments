# OpenExperiments

A platform for hypothesis generation, crowdsourced ranking, and empirical testing. OpenExperiments bridges AI-generated hypotheses with human evaluation and real-world experimentation.

## Features

- **Hypothesis Submission & Discovery** — Browse, submit, and star research hypotheses
- **Arena Ranking** — Elo-based pairwise voting to surface the best hypotheses
- **Experiment Tracking** — Link hypotheses to experiments with statistical results
- **Problem Statements** — Organize hypotheses around key research questions
- **Datasets** — Browse datasets available for experimentation
- **Google OAuth** — Authentication with session management
- **Researcher Profiles** — Track contributions per user

## Tech Stack

| Layer      | Tech                                      |
| ---------- | ----------------------------------------- |
| Framework  | Next.js 15.5.2 (App Router, Edge Runtime) |
| Deployment | Cloudflare Pages                          |
| Database   | Cloudflare D1 (SQLite) via Drizzle ORM    |
| Auth       | Arctic (Google OAuth)                     |
| Styling    | Tailwind CSS v4                           |
| Language   | TypeScript                                |

## Project Structure

```
├── src/
│   ├── app/
│   │   ├── api/                  # Edge API routes
│   │   ├── arena/                # Pairwise voting UI
│   │   ├── data/[id]/            # Dataset detail
│   │   ├── experiments/[id]/     # Experiment detail
│   │   ├── explore/              # Hypothesis browser
│   │   ├── hypothesis/[id]/      # Hypothesis detail
│   │   ├── profile/[id]/         # User profile
│   │   └── submit/               # Submit a hypothesis
│   ├── components/               # Shared React components
│   ├── db/
│   │   ├── index.ts              # D1 client (getCloudflareContext)
│   │   └── schema.ts             # Drizzle schema
│   └── lib/
│       ├── api.ts                # Client-side fetch helpers
│       ├── auth.ts               # Session resolution
│       └── types.ts              # Shared TypeScript interfaces
├── drizzle/migrations/           # SQL migration files
├── mcp-server/                   # MCP server (separate package)
├── scripts/seed.sql              # Seed data
├── wrangler.toml                 # Cloudflare config
└── next.config.ts                # Next.js config
```

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Fill in `.env`:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
APP_URL=http://localhost:3000
CLOUDFLARE_ACCOUNT_ID=...
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_D1_DATABASE_ID=...
```

Get Google OAuth credentials at [console.cloud.google.com](https://console.cloud.google.com) — add `http://localhost:3000/api/auth/google/callback` as an authorized redirect URI.

### 3. Set up local D1 database

```bash
npm run wrangler -- d1 migrations apply openexperiments-db --local
npm run wrangler -- d1 execute openexperiments-db --local --file=scripts/seed.sql
```

### 4. Start the dev server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000).

## Database

### Schema

| Table                        | Purpose                    |
| ---------------------------- | -------------------------- |
| `users`                      | Registered users           |
| `sessions`                   | Auth sessions              |
| `hypotheses`                 | Core hypothesis records    |
| `problem_statements`         | Research questions         |
| `datasets`                   | Available datasets         |
| `dataset_problem_statements` | Many-to-many join          |
| `experiments`                | Linked experiments         |
| `experiment_versions`        | Versioned experiment plans |
| `experiment_results`         | Statistical results        |
| `comments`                   | Hypothesis comments        |
| `arena_matchups`             | Pairwise matchup records   |
| `arena_votes`                | Per-user votes             |
| `stars`                      | User stars on hypotheses   |

### Migrations

Generate a migration after editing `src/db/schema.ts`:

```bash
npx drizzle-kit generate
```

Apply locally:

```bash
npm run wrangler -- d1 migrations apply openexperiments-db --local
```

Apply to production:

```bash
npm run wrangler -- d1 migrations apply openexperiments-db --remote
```

### Query the database

```bash
# Local
npm run wrangler -- d1 execute openexperiments-db --local --command="SELECT COUNT(*) FROM hypotheses"

# Remote
npm run wrangler -- d1 execute openexperiments-db --remote --command="SELECT COUNT(*) FROM hypotheses"
```

## Deployment

### Automatic (recommended)

The repo is connected to Cloudflare Pages. Every push to `main` triggers a production deploy automatically.

Build settings:

- **Build command**: `npx @cloudflare/next-on-pages`
- **Build output directory**: `.vercel/output/static`

### Manual

```bash
npm run deploy
```

This runs `npx @cloudflare/next-on-pages` then deploys via wrangler.

### First-time setup

See the steps below if setting up a new Cloudflare environment from scratch.

**1. Create D1 database**

```bash
npm run wrangler -- d1 create openexperiments-db
# Copy the database_id into wrangler.toml
```

**2. Run migrations and seed**

```bash
npm run wrangler -- d1 migrations apply openexperiments-db --remote
npm run wrangler -- d1 execute openexperiments-db --remote --file=scripts/seed.sql
```

**3. Create Pages project and set secrets**

```bash
npm run wrangler -- pages project create openexperiments --production-branch main
npm run wrangler -- pages secret put GOOGLE_CLIENT_ID --project-name openexperiments
npm run wrangler -- pages secret put GOOGLE_CLIENT_SECRET --project-name openexperiments
npm run wrangler -- pages secret put APP_URL --project-name openexperiments
```

**4. Bind D1 to Pages**

In the Cloudflare dashboard: Pages → openexperiments → Settings → Functions → D1 database bindings → add `DB` → `openexperiments-db`.

**5. Deploy**

```bash
npm run deploy
```

### Rollback

```bash
npm run wrangler -- pages deployment list --project-name openexperiments
npm run wrangler -- pages deployment rollback <DEPLOYMENT_ID> --project-name openexperiments
```

## MCP Server

The `mcp-server/` directory is a standalone Model Context Protocol server exposing the platform's API as tools for AI assistants.

```bash
cd mcp-server && npm install && npm run build
```

Configure with `OPENEXPERIMENTS_API_URL` pointing to the running app.

## Environment Variables

| Variable                    | Required  | Description                                        |
| --------------------------- | --------- | -------------------------------------------------- |
| `GOOGLE_CLIENT_ID`          | Yes       | Google OAuth client ID                             |
| `GOOGLE_CLIENT_SECRET`      | Yes       | Google OAuth client secret                         |
| `APP_URL`                   | Yes       | Base URL (no trailing slash)                       |
| `CLOUDFLARE_ACCOUNT_ID`     | CI only   | Cloudflare account ID                              |
| `CLOUDFLARE_API_TOKEN`      | CI only   | API token with Pages + D1 write permissions        |
| `CLOUDFLARE_D1_DATABASE_ID` | Reference | D1 database UUID                                   |
| `DB`                        | Runtime   | D1 binding (set in Cloudflare dashboard, not .env) |

## Troubleshooting

**"Database binding not found"** — Check the D1 binding (`DB`) is configured in Cloudflare Pages → Settings → Functions and that `wrangler.toml` has the correct `database_id`.

**OAuth redirect mismatch** — Verify `APP_URL` matches your deployment URL exactly and the redirect URI in Google Cloud Console matches `${APP_URL}/api/auth/google/callback`.

**Build fails with edge runtime error** — All non-static pages must export `export const runtime = "edge"`. Check the failing route.

**`npx wrangler` not found** — Use `npm run wrangler -- <command>` instead (local wrangler binary path issue).

## Contributing

- All API routes must export `export const runtime = "edge"`
- Database queries must use Drizzle ORM — no raw SQL in application code
- New schema changes require a migration: `npx drizzle-kit generate`
- TypeScript strict mode is on — no `any`, no suppressed errors

## License

MIT
