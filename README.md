# OpenExperiments

A platform for hypothesis generation, crowdsourced ranking, and empirical testing. OpenExperiments bridges AI-generated hypotheses with human evaluation and real-world experimentation.

## Features

- **Hypothesis Submission & Discovery** - Browse and submit research hypotheses
- **Arena Ranking System** - Elo-based pairwise comparison for hypothesis evaluation
- **Experiment Tracking** - Link hypotheses to experiments with results and statistical analysis
- **Problem Statements** - Organize hypotheses around key research questions
- **Google OAuth Authentication** - Secure user authentication with session management
- **Researcher Profiles** - Track contributions with Google Scholar integration

## Tech Stack

- **Framework**: Next.js 16.1.6 (App Router)
- **Runtime**: Cloudflare Pages (Edge Runtime)
- **Database**: Cloudflare D1 (SQLite) with Drizzle ORM
- **Authentication**: Arctic (Google OAuth)
- **Styling**: Tailwind CSS v4
- **Language**: TypeScript

## Prerequisites

- **Node.js** 20 or later
- **npm** or yarn
- **Cloudflare Account** (for deployment)
- **Google OAuth Credentials** (for authentication)

## Local Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create a `.dev.vars` file in the project root with the following variables:

```bash
APP_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
SESSION_SECRET=your-secure-random-string-min-32-chars
```

**Generate a secure SESSION_SECRET:**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Get Google OAuth Credentials:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.dev.vars`

### 3. Set Up Local D1 Database

Apply the database schema:

```bash
wrangler d1 execute openexperiments-db --local --file=./drizzle/migrations/0000_certain_butterfly.sql
```

Seed with initial data:

```bash
wrangler d1 execute openexperiments-db --local --file=./scripts/seed.sql
```

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Database Management

### Refresh/Reseed Local Database

To reload seed data (this will duplicate data if run multiple times):

```bash
wrangler d1 execute openexperiments-db --local --file=./scripts/seed.sql
```

To completely reset the database:

```bash
# Drop all tables and reapply schema
wrangler d1 execute openexperiments-db --local --file=./drizzle/migrations/0000_certain_butterfly.sql

# Reseed
wrangler d1 execute openexperiments-db --local --file=./scripts/seed.sql
```

### View Database Contents

**Local database:**

```bash
wrangler d1 execute openexperiments-db --local --command="SELECT * FROM hypotheses LIMIT 10"
wrangler d1 execute openexperiments-db --local --command="SELECT * FROM users"
wrangler d1 execute openexperiments-db --local --command="SELECT name FROM sqlite_master WHERE type='table'"
```

**Production database:**

```bash
wrangler d1 execute openexperiments-db --remote --command="SELECT COUNT(*) FROM hypotheses"
```

### Generate New Migrations

After modifying `src/db/schema.ts`:

```bash
npx drizzle-kit generate
```

This creates a new migration file in `drizzle/migrations/`.

### Apply Migrations

**Local:**

```bash
wrangler d1 execute openexperiments-db --local --file=./drizzle/migrations/<new-migration-file>.sql
```

**Production:**

```bash
wrangler d1 execute openexperiments-db --remote --file=./drizzle/migrations/<new-migration-file>.sql
```

## Cloudflare Pages Deployment

### Step 1: Create Production D1 Database

```bash
wrangler d1 create openexperiments-db
```

**Expected output:**

```
✅ Successfully created DB 'openexperiments-db'

[[d1_databases]]
binding = "DB"
database_name = "openexperiments-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

Copy the `database_id` from the output.

### Step 2: Update wrangler.toml

Open `wrangler.toml` and replace the database ID:

```toml
name = "openexperiments"
compatibility_date = "2025-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "openexperiments-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # Your production database ID
```

### Step 3: Run Production Migrations

Apply the database schema:

```bash
wrangler d1 execute openexperiments-db --remote --file=./drizzle/migrations/0000_certain_butterfly.sql
```

Verify tables were created:

```bash
wrangler d1 execute openexperiments-db --remote --command="SELECT name FROM sqlite_master WHERE type='table'"
```

**Expected tables:**

- users
- sessions
- hypotheses
- experiments
- experiment_results
- comments
- arena_matchups
- arena_votes
- problem_statements

### Step 4: (Optional) Seed Production Data

```bash
wrangler d1 execute openexperiments-db --remote --file=./scripts/seed.sql
```

**Note:** Review `scripts/seed.sql` before running to ensure data is appropriate for production.

### Step 5: Configure Production Environment Variables

**Option A - Via Wrangler CLI:**

```bash
npx wrangler pages secret put APP_URL
# Enter: https://openexperiments.pages.dev (or your custom domain)

npx wrangler pages secret put GOOGLE_CLIENT_ID
# Enter: your-production-google-client-id

npx wrangler pages secret put GOOGLE_CLIENT_SECRET
# Enter: your-production-google-client-secret

npx wrangler pages secret put SESSION_SECRET
# Enter: (generate a new one with the crypto command above)
```

**Option B - Via Cloudflare Dashboard:**

1. Go to Cloudflare Dashboard → Pages → Your Project
2. Navigate to **Settings** → **Environment Variables**
3. Add variables for the **Production** environment:
   - `APP_URL` = `https://openexperiments.pages.dev`
   - `GOOGLE_CLIENT_ID` = your production client ID
   - `GOOGLE_CLIENT_SECRET` = your production client secret
   - `SESSION_SECRET` = secure random string (min 32 chars)

### Step 6: Update Google OAuth Configuration

In [Google Cloud Console](https://console.cloud.google.com/):

1. Navigate to **APIs & Services** → **Credentials**
2. Select your OAuth 2.0 Client ID
3. Add **Authorized redirect URI**:
   ```
   https://openexperiments.pages.dev/api/auth/google/callback
   ```
4. Add **Authorized JavaScript origin**:
   ```
   https://openexperiments.pages.dev
   ```
5. Save changes

### Step 7: Deploy to Cloudflare Pages

**Option A - CLI Deployment:**

```bash
# Authenticate with Cloudflare
npx wrangler login

# Build the Next.js application
npm run build

# Build for Cloudflare Pages
npx @cloudflare/next-on-pages

# Deploy
npx wrangler pages deploy .vercel/output/static --project-name=openexperiments
```

**Option B - Git Integration (Recommended for CI/CD):**

1. Push your code to GitHub, GitLab, or Bitbucket
2. In Cloudflare Dashboard:
   - Go to **Pages** → **Create a project**
   - Select **Connect to Git**
   - Choose your repository and authorize Cloudflare
3. Configure build settings:
   - **Production branch**: `main`
   - **Build command**: `npm run build && npx @cloudflare/next-on-pages`
   - **Build output directory**: `.vercel/output/static`
   - **Root directory**: (leave blank, or `/website` if in a monorepo)
4. Add environment variables in the setup wizard (Step 5 above)
5. Click **Save and Deploy**

This will automatically deploy on every push to `main` and create preview deployments for pull requests.

### Step 8: Verify Deployment

Test these critical endpoints:

1. **Homepage**: `https://openexperiments.pages.dev/`
2. **API Routes**:
   - `/api/hypotheses`
   - `/api/problem-statements`
   - `/api/arena/matchup`
3. **Authentication**:
   - Click "Sign in with Google"
   - Complete OAuth flow
   - Verify session persistence
4. **Database Operations**:
   - Browse hypotheses at `/explore`
   - Vote in `/arena`
   - Submit a hypothesis at `/submit`

## Custom Domain Setup (Optional)

### Add Custom Domain via CLI

```bash
npx wrangler pages domain add yourdomain.com openexperiments
```

### Add Custom Domain via Dashboard

1. Go to Cloudflare Dashboard → Pages → Your Project
2. Navigate to **Custom domains**
3. Click **Set up a custom domain**
4. Enter your domain and follow the instructions
5. Add a CNAME record in your DNS:
   ```
   yourdomain.com → openexperiments.pages.dev
   ```

### Update Configuration

After adding a custom domain:

1. **Update `APP_URL` environment variable** to `https://yourdomain.com`
2. **Update Google OAuth redirect URIs** to include:
   ```
   https://yourdomain.com/api/auth/google/callback
   ```

## Refresh/Reseed Production Database

**Warning:** This will add duplicate data if run multiple times. Consider clearing relevant tables first.

```bash
# Reseed production database
wrangler d1 execute openexperiments-db --remote --file=./scripts/seed.sql
```

To clear specific tables before reseeding:

```bash
# Clear hypotheses
wrangler d1 execute openexperiments-db --remote --command="DELETE FROM hypotheses WHERE submitted_by = 'system'"

# Clear users
wrangler d1 execute openexperiments-db --remote --command="DELETE FROM users WHERE id = 'system'"

# Then reseed
wrangler d1 execute openexperiments-db --remote --file=./scripts/seed.sql
```

## Troubleshooting

### "Database binding not found"

- Verify the D1 binding in `wrangler.toml` matches the code (`DB`)
- Ensure the database exists: `wrangler d1 list`
- Check that the database ID is correct in `wrangler.toml`

### OAuth Redirect Mismatch Error

- Verify `APP_URL` environment variable matches your deployment URL
- Check Google Cloud Console redirect URIs match exactly (no trailing slashes)
- Ensure both authorized redirect URI and JavaScript origin are configured

### Build Fails

- Ensure Node.js version is 20 or later: `node --version`
- Check all dependencies are installed: `npm install`
- Verify all API routes have `export const runtime = "edge"`
- Clear build cache: `rm -rf .next .vercel`

### Session Not Persisting

- Verify `SESSION_SECRET` is set in production
- Check that the secret is at least 32 characters long
- Ensure cookies are working (HTTPS required in production)

### View Deployment Logs

```bash
# List deployments
npx wrangler pages deployment list --project-name=openexperiments

# Tail logs in real-time
npx wrangler pages deployment tail --project-name=openexperiments
```

## Project Structure

```
/website
├── src/
│   ├── app/              # Next.js App Router pages
│   │   ├── api/          # API routes (all edge runtime)
│   │   ├── arena/        # Arena ranking UI
│   │   ├── explore/      # Browse hypotheses
│   │   └── submit/       # Submit new hypotheses
│   ├── components/       # React components
│   ├── db/
│   │   ├── index.ts      # D1 database client
│   │   └── schema.ts     # Drizzle ORM schema
│   └── lib/              # Utilities and helpers
├── drizzle/
│   └── migrations/       # Database migrations
├── scripts/
│   └── seed.sql          # Seed data
├── wrangler.toml         # Cloudflare configuration
└── next.config.ts        # Next.js configuration
```

## Rollback Deployment

If you need to rollback to a previous deployment:

```bash
# List all deployments
npx wrangler pages deployment list --project-name=openexperiments

# Rollback to specific deployment
npx wrangler pages deployment rollback <DEPLOYMENT_ID> --project-name=openexperiments
```

Or via Dashboard:

1. Go to Cloudflare Dashboard → Pages → Your Project
2. Click "View build" on a previous successful deployment
3. Click "Rollback to this deployment"

## Contributing

Contributions are welcome! Please ensure:

- All API routes use `export const runtime = "edge"`
- Database queries use Drizzle ORM
- TypeScript types are properly defined
- New migrations are generated with `drizzle-kit generate`

## License

[Add your license here]
