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
├── scripts/seed.sql              # Real CMV + ICLR catalog (no mock research results)
├── scripts/catalog.sql           # Idempotent existing-database catalog update
├── scripts/seed-demo.sql         # Optional mock fixtures for disposable demo DBs
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

The development server uses `.next-dev` so production builds in `.next` do not
interrupt it. Set `NEXT_DIST_DIR` to override the output directory when needed.

### Persuasion launch review

Prepare a separate review database from the submitted OSF study JSON and registration
ledgers in `~/GitHub/browser-agent`. This imports 35 CMV ledger entries and 22 ICLR
registrations, retaining secondary hypotheses and analysis plans. Drafts without
registration links (`study-24`, `study-27`, `study-30`) are excluded.

```bash
node scripts/research-catalog.mjs
node scripts/launch-catalog.mjs --source-root ~/GitHub/browser-agent
npm run wrangler -- d1 migrations apply openexperiments-db --local --persist-to=.wrangler/launch-review
npm run wrangler -- d1 execute openexperiments-db --local --persist-to=.wrangler/launch-review --file=.wrangler/launch-review/seed.sql
LOCAL_D1_STATE_DIR=.wrangler/launch-review/v3 NEXT_DIST_DIR=.next-launch npm run dev -- --hostname 127.0.0.1 --port 3001
```

Optional `--status-file <path>` accepts a JSON array of public OSF API checks
(`study`, `id`, `public`, `registered`, `withdrawn`, or `http_status`). A submitted ICLR
JSON must match its source manifest's SHA-256; missing or modified source files fail
the import explicitly.

Wrangler appends `v3` to `--persist-to`; Next's platform proxy expects the actual
storage directory, so `LOCAL_D1_STATE_DIR` includes that suffix.
Open [http://localhost:3001](http://localhost:3001) for review. Use `localhost`,
not `127.0.0.1`, as the browser origin: Next development requests use the former,
and arena voting rejects mismatched origins.

The generated SQL and source snapshot stay in gitignored `.wrangler/launch-review`.
They are **local review material, not a production seed**: CMV registrations are
listed as private/embargoed in the ledger and cannot currently be verified publicly;
`study-26` is also listed in the pending section and its `26mah` link returns 404.
Resolve that entry and publication permission before public launch. The public ICLR
ledger has 19 primary and three separately registered exploratory studies.

All imported hypotheses are proposed/live; submitted studies are running/under test,
as confirmed by the team, with no
invented results, evidence scores or arena votes. Plans refer to prospective
collections, not the historical datasets as if they were confirmatory data.
The arena starts with a deterministic ring of same-question pairs, covering every
hypothesis without inventing votes or comparing CMV against ICLR.
The import is insert-only for hypotheses/plans and preserves existing lifecycle state
and user edits when rerun. Do not use the existing mock database for this review.
No production data, OSF registrations or embargo settings are changed.

To correct an existing review database that still shows these studies as planned,
regenerate the launch catalog and apply `.wrangler/launch-review/activate.sql`.
It advances only the exact imported planned studies to running, records a new
experiment version, and preserves completed studies and previous plan snapshots:

```bash
npm run wrangler -- d1 execute openexperiments-db --local --persist-to=.wrangler/launch-review --file=.wrangler/launch-review/activate.sql
```

Running means the study is under test, not that its hypothesis has passed empirical
validation. Registration visibility/approval and research execution state are separate.

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

### Real problem statements and datasets

The curated catalog contains **CMV counterargument persuasion** and **ICLR peer-review
rebuttal persuasion**, linked to
[Harini/changemyview_data](https://huggingface.co/datasets/Harini/changemyview_data) and
[Harini/iclr_reviews](https://huggingface.co/datasets/Harini/iclr_reviews).
Metadata, selected analysis variables, split sizes, and limitations are recorded from
the dataset cards verified on November 5, 2026, with revision hashes in the catalog.
The website registers these research instruments; it does not copy their multi-gigabyte
CSV files into D1.

CMV has 572,119 training, 6,000 random-holdout, and 116,472 temporal-holdout rows.
ICLR has 44,126 training and 11,099 test reviews from 2024 and 2025. Its `label`
records **any** rating change, including decreases; it cannot recover the planned
ICLR 2027 `improved` outcome because final ratings are not exported. ICLR 2026 is
excluded because its discussion was frozen and ratings were reset after a security
incident. Prospective studies are separate from the historical datasets: ICLR studies
plan to test on a future conference cycle, and CMV studies on posts created after
registration. Neither HF card specifies a dataset-wide license. OpenReview comments
and metadata are subject to its [terms](https://openreview.net/legal/terms), while
ICLR and Reddit content may have additional rights and conditions.

Dataset detail pages render links and inline code in scientific characterization text,
and display one-variable-per-line definitions as semantic HTML definition lists.

Edit `src/lib/data/research-catalog.json`, then regenerate the SQL:

```bash
node scripts/research-catalog.mjs
node scripts/research-catalog.mjs --check
```

For an existing local database:

```bash
npm run wrangler -- d1 execute openexperiments-db --local --file=scripts/catalog.sql
```

Apply the same file with `--remote` when intentionally updating production. This
upserts both instruments, merges the old CMV conversational question into `ps-1`,
retires the three exact original mock questions, and recomputes hypothesis counts.
It preserves user-submitted catalog entries and does not delete hypotheses,
experiments, results, or votes. Existing mock research records therefore remain
mock until separately replaced; dataset registration does not validate them.
Non-CMV hypotheses retain their question text even when its mock catalog entry is
retired. Fresh databases seeded with `seed.sql` contain no mock research records.
No schema migration is needed for this catalog-only update.

The optional `seed-demo.sql` is only for a fresh disposable demo database and must
be applied **before** `seed.sql` to replace its obsolete mock catalog. Do not apply
it to an existing or production database. Database updates do not purge Cloudflare
HTTP or edge-query caches; cached pages can remain stale until their TTL expires
(up to one hour for problem-statement API responses).

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
