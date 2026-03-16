# MCP Server - Database Migration Compatibility Check

**Status:** ✅ **COMPATIBLE** - MCP server works with all migrations

**Last Verified:** 2026-03-16
**Migrations Checked:** 0000 through 0003
**MCP Version:** v1.1.0 - Domain Flexibility + ExperiGen Philosophy

---

## Migration Summary

| Migration                         | Changes                                                  | MCP Impact                           |
| --------------------------------- | -------------------------------------------------------- | ------------------------------------ |
| `0000_useful_misty_knight.sql`    | Initial schema                                           | ✅ Baseline                          |
| `0001_add_position_and_stars.sql` | Added `users.position`, `stars` table                    | ✅ None - MCP doesn't use these      |
| `0002_experiment_versions.sql`    | Added `experiments.version`, `experiment_versions` table | ✅ None - MCP doesn't use versioning |
| `0003_add_win_rate_columns.sql`   | Added `hypotheses.winRate`, `arenaWins`, `arenaTotal`    | ✅ **MCP uses winRate**              |

---

## Detailed Field Verification

### Hypotheses API (`/api/hypotheses`)

**MCP Expectations:**

- id, statement, rationale ✅
- status, phase, source, agentName ✅
- domain (array), problemStatement ✅
- submittedAt ✅
- arenaElo, evidenceScore ✅
- pValue, effectSize ✅
- commentCount, citationDois, relatedHypothesisIds ✅

**API Returns:** All expected fields ✅

**Note:** `/api/hypotheses` list endpoint does NOT return `winRate` (by design — not needed for list view)

### Hypothesis Detail API (`/api/hypotheses/:id`)

**MCP Expectations:**

- All fields from list view PLUS
- **winRate** ✅ (line 64 in route.ts)

**API Returns:** All expected fields ✅

**Implementation:** Uses `hypotheses.winRate` column from migration 0003, falls back to computed value via `getWinRate()` if null.

### Arena Rankings API (`/api/arena/rankings`)

**MCP Expectations:**

- id, statement, domain, **winRate** ✅

**API Returns:** All expected fields ✅

**Implementation:** Uses `hypotheses.winRate` column (fast path) or computes from matchups (fallback).

### Experiments API (`/api/experiments`)

**MCP Expectations:**

- id, hypothesisId, type, status ✅
- datasetName, methodology ✅
- startedAt, completedAt ✅
- results.{pValue, effectSize, sampleSize, confidenceInterval, summary, uplift} ✅

**API Returns:** All expected fields PLUS `version` (migration 0002) ✅

**Note:** Extra field `version` is ignored by MCP — no compatibility issue.

### Datasets API (`/api/datasets`)

**MCP Expectations:**

- id, name, huggingfaceUrl ✅
- taskDescription, dataColumnNames, targetColumnName ✅
- description, domain ✅
- problemStatementCount, experimentCount ✅

**API Returns:** All expected fields ✅

### Problem Statements API (`/api/problem-statements`)

**MCP Expectations:**

- id, question, description, domain ✅
- hypothesisCount ✅
- datasets (when includeDatasets=true) ✅

**API Returns:** All expected fields ✅

---

## Known Non-Issues

1. **experiments.version field**
   - Migration 0002 added this field (default: 1)
   - MCP doesn't reference it
   - API returns it, but MCP tools don't display it
   - **Impact:** None - ignored safely

2. **stars table**
   - Migration 0001 added starring functionality
   - MCP has no starring tools (by design — read-only discovery)
   - **Impact:** None

3. **users.position field**
   - Migration 0001 added this
   - MCP doesn't display user profiles
   - **Impact:** None

4. **hypotheses.arenaWins, arenaTotal**
   - Migration 0003 added these for efficient win rate computation
   - MCP only uses the computed `winRate` value, not the raw counters
   - **Impact:** None - internal optimization

---

## Potential Future Concerns

### If winRate Column is Null

**Scenario:** Older hypotheses may have `winRate = null` if not backfilled.

**MCP Behavior:**

- `get_arena_rankings` — API handles this via fallback computation (line 40-68 in route.ts)
- `get_hypothesis` — API computes it on-demand via `getWinRate()` (line 39 in route.ts)

**Resolution:** ✅ API handles nulls gracefully — MCP always gets a valid value.

### If New Fields Are Added to Experiments

**Risk:** MCP might break if experiment results structure changes.

**Mitigation:** MCP uses `results.pValue`, `results.effectSize`, etc. — as long as these exist in the returned object, MCP works.

### If Hypothesis Domain Field Type Changes

**Current:** `hypotheses.domains` is JSON array, API returns it as `domain` (array)

**MCP Handling:** Line 183, 214 check `Array.isArray(h.domain)` before joining — robust against single value or array.

---

## Recent MCP Updates (2026-03-16)

### Domain Flexibility

**Change:** All domain parameter schemas changed from `z.enum(["persuasion", "memorability"])` to `z.string()`.

**Affected Tools:**

- `list_datasets` (line 89)
- `search_hypotheses` (line 182)
- `generate_submission_url` (line 454)
- `co-ideate` prompt (line 678)

**Impact:**

- ✅ Users can now explore hypotheses in ANY domain (attention, learning, memory, etc.)
- ✅ Non-standard domains trigger a warning in `generate_submission_url` with GitHub issue guidance
- ✅ Backend validation still restricts to standard domains, but MCP enables exploration
- ✅ Backward compatible: standard domains ("persuasion", "memorability") still work

### ExperiGen Philosophy Integration

**Change:** Added comprehensive feature extractability guidance throughout the MCP server.

**Updated Sections:**

1. **platform_overview tool (lines 405-420):**
   - New section: "Philosophy: ExperiGen Feature Extractability"
   - Lists extractable features (brightness, sentiment, faces, duration)
   - Lists non-extractable features (mood, intent, cultural, temporal if missing)
   - Encourages proposing new domains

2. **list_datasets tool (lines 108-117):**
   - Added "Extractable Features" field for each dataset
   - Temporary extractability maps for ds-1 through ds-4
   - Shows what can be computed via code, NLP, VLM

3. **get_dataset tool (lines 149-157):**
   - Detailed extractability info with methods
   - ❌ examples of what CANNOT be extracted

4. **formulate-hypothesis prompt (lines 536-659):**
   - Complete rewrite of "What Makes a Good Hypothesis" section
   - Feature extractability as criterion #1 with ✅/❌ examples
   - "Available Datasets (What Can Be Extracted?)" section
   - Workflow emphasizes extraction method explanation
   - Diverse hypothesis sampling (max 2 per domain, ELO > 1400)

5. **co-ideate prompt (lines 691-730):**
   - Extractability focus in brainstorming
   - "Check extractability" as step 4
   - Encourages proposing new domains

6. **platform-guide resource (lines 760-787):**
   - Complete ExperiGen philosophy section
   - Extractable vs non-extractable examples
   - Domains section includes "[Propose New]"

**Impact:**

- ✅ Users understand what features CAN vs CANNOT be tested
- ✅ Clear guidance on extraction methods (code, NLP, VLM)
- ✅ Reduces non-testable hypothesis submissions
- ✅ Educational: teaches computational feature extraction

### API Compatibility

**No API changes required.** All updates are in MCP tool descriptions, prompts, and output formatting.

- ✅ API endpoints unchanged
- ✅ Response schemas unchanged
- ✅ Domain parameter handling unchanged (APIs still validate to enum)
- ✅ MCP-level domain flexibility doesn't affect backend

### Testing

See comprehensive testing guide: `/mcp-server/TESTING_GUIDE.md`
Quick smoke test: `/mcp-server/QUICK_TEST.md`

**Critical Tests:**

- ✅ Build succeeds: `npm run build`
- ✅ Domain flexibility: Non-standard domains accepted without schema errors
- ✅ Warnings: Non-standard domains trigger GitHub issue guidance
- ✅ ExperiGen philosophy: Appears in platform_overview, datasets, prompts
- ✅ Extractability info: All datasets show extractable features

---

## Testing Checklist

Before deploying MCP with new migrations:

- [ ] Run `platform_overview` — verify hypothesis counts, no errors
- [ ] Run `search_hypotheses` with `query: "persuasive"` — verify results format
- [ ] Run `get_hypothesis` with known ID — verify winRate is present and numeric
- [ ] Run `get_arena_rankings` — verify winRate in every result
- [ ] Run `list_experiments` — verify results structure unchanged
- [ ] Run `list_datasets` — verify schema fields present
- [ ] Run `list_problem_statements` — verify includeDatasets works

---

## Conclusion

**All migrations are compatible with the MCP server.** No code changes needed.

The MCP server:

- ✅ Uses only stable, public API fields
- ✅ Handles `winRate` correctly (migration 0003)
- ✅ Ignores `version` field harmlessly (migration 0002)
- ✅ Doesn't touch `stars` or `position` (migration 0001)

**Safe to deploy and test immediately.**
