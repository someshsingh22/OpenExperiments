# MCP Server Update: Domain Flexibility + ExperiGen Philosophy

**Date:** 2026-03-16
**Version:** v1.1.0
**Status:** ✅ Implementation Complete, Ready for Testing

---

## Summary

The OpenExperiments MCP server has been updated to:

1. **Accept any domain string** (not just "persuasion" and "memorability")
2. **Integrate ExperiGen philosophy** throughout with feature extractability guidance

All changes are backward compatible and require no API modifications.

---

## What Changed

### 1. Domain Flexibility (7 Changes)

All Zod enum restrictions changed from `z.enum(["persuasion", "memorability"])` to `z.string()`:

| Location                      | Tool/Prompt        | Line |
| ----------------------------- | ------------------ | ---- |
| Tool: list_datasets           | Parameter: domain  | 89   |
| Tool: search_hypotheses       | Parameter: domain  | 182  |
| Tool: generate_submission_url | Parameter: domains | 454  |
| Prompt: co-ideate             | Parameter: domain  | 678  |

**Impact:**

- Users can explore hypotheses in ANY domain (attention, learning, memory, etc.)
- Non-standard domains trigger a helpful warning with GitHub issue guidance
- Standard domains ("persuasion", "memorability") continue to work without warnings

---

### 2. ExperiGen Philosophy Integration

Added comprehensive feature extractability guidance in 6 locations:

#### A. platform_overview Tool (Lines 405-420)

**New Section:** "Philosophy: ExperiGen Feature Extractability"

**Content:**

- Core principle: "Hypotheses must test features COMPUTABLE from available data"
- ✅ Extractable examples: brightness from pixels, sentiment from text, faces via VLM, duration from timestamps
- ❌ Non-extractable examples: viewer's mood, author's intent, cultural significance
- Encourages proposing new domains

---

#### B. list_datasets Tool (Lines 108-117)

**New Field:** "Extractable Features" for each dataset

**Extractability Maps:**

- **ds-1 (Reddit CMV):** Text sentiment, length, readability, named entities (NLP); User karma, post history; Temporal patterns
- **ds-2 (LaMem):** Image brightness, contrast, color distribution; Face count, objects, scene category (VLM); Composition features
- **ds-3 (Twitter):** Tweet sentiment, hashtags, mentions, length; Engagement metrics
- **ds-4 (Visual Attention):** Same as LaMem + attention gaze patterns, fixation duration

---

#### C. get_dataset Tool (Lines 149-157)

**Enhanced Detail:** Detailed extractability with ❌ examples

**Example for ds-2 (LaMem):**

```
Extractable Features:
• Image: brightness, contrast, color distribution, dominant colors
• Objects: face count, object types, scene category (via VLM)
• Composition: focal points, rule of thirds alignment
• ❌ Cannot extract: emotional impact on viewer, cultural significance
```

---

#### D. formulate-hypothesis Prompt (Lines 536-659)

**Major Refactor:** Complete rewrite of hypothesis formulation guidance

**Changes:**

- **"What Makes a Good Hypothesis (ExperiGen Philosophy)"** section
  - Feature extractability as criterion #1
  - ✅ examples with extraction methods (warm colors → RGB, faces → VLM, sentiment → NLP)
  - ❌ examples with reasons (viewer's mood → not in dataset)

- **"Available Datasets (What Can Be Extracted?)"** section
  - Lists extraction methods: Code, NLP/LLM, VLM, Statistical
  - Key question: "Can I compute this feature from the available columns?"

- **"Your Workflow"** section
  - Step 2: Identify extractable features
  - Step 5: Explain EXACTLY how features would be extracted
  - Step 6: Handle data gaps with GitHub PR suggestion

- **Diverse Hypothesis Sampling**
  - Loads 30 hypotheses (up from 5)
  - Filters: phase='completed' AND arenaElo > 1400
  - Samples max 2 per domain for diversity
  - Shows up to 8 total

---

#### E. co-ideate Prompt (Lines 691-730)

**Updated Brainstorming:** Extractability focus in ideation

**Changes:**

- Opening: "Explore ANY domain—not just persuasion/memorability"
- Lists extraction types: code-based, LLM-based, VLM-based
- Step 4: "Check extractability — Can the feature be computed from existing data?"
- Step 5: "Propose new domains" (attention, learning, memory consolidation, etc.)

---

#### F. platform-guide Resource (Lines 760-787)

**Static Resource:** Complete ExperiGen philosophy section

**Content:**

- "Core principle: Hypotheses test features COMPUTABLE from existing data"
- Extractable examples with methods
- Non-extractable examples with reasons
- Key question: "Can I compute this using the available columns + AI/code?"
- Domains section: "[Propose New]: Attention, learning, memory, decision-making, perception..."

---

### 3. Non-Standard Domain Warning (Lines 488-506)

**New Feature:** `generate_submission_url` warns when using non-standard domains

**Warning Content:**

```
⚠️  Domain Submission Note

Your hypothesis uses: [non-standard domain names]

The platform currently accepts hypotheses in these domains through
the web UI, but the domain field will be restricted to standard options.
Your hypothesis will be associated with an existing domain that's closest.

To propose "[domain]" as a new official domain:
1. Open an issue at [site]/issues (GitHub link in footer)
2. Describe the domain and why it's valuable
3. Optionally: suggest datasets for this domain
4. Community + maintainers will review

Your hypothesis can still be submitted! The problem statement you
propose will be recorded with your custom text.
```

**Behavior:**

- Filters domains to identify non-standard ones
- Only standard domains: ["persuasion", "memorability"]
- Shows warning only if non-standard domains present
- Provides actionable next steps (GitHub issue)

---

## File Changes

### Primary File

- `/mcp-server/src/index.ts` — ~150 lines modified

### Documentation

- `/mcp-server/TESTING_GUIDE.md` — Comprehensive test suite (NEW)
- `/mcp-server/QUICK_TEST.md` — 15-minute smoke test (NEW)
- `/mcp-server/MIGRATION_COMPATIBILITY.md` — Updated with v1.1.0 changes
- `/mcp-server/IMPLEMENTATION_SUMMARY.md` — This file (NEW)
- `/mcp-server/test-logs/TEST_RESULTS_TEMPLATE.md` — Test result recording template (NEW)

### Build Output

- `/mcp-server/dist/index.js` — Built successfully (36KB)
- `/mcp-server/dist/index.d.ts` — Type definitions

---

## API Compatibility

**No API changes required.**

- ✅ All existing API endpoints unchanged
- ✅ Response schemas unchanged
- ✅ Backend validation unchanged (still restricts domains)
- ✅ MCP-level changes are display/guidance only

The MCP accepts any domain string, but the backend APIs still validate to ["persuasion", "memorability"]. This is intentional: the MCP enables exploration and formulation in any domain, but submission is guided through the standard process or GitHub PR for new domains.

---

## Testing Status

### Build

- ✅ TypeScript compilation successful
- ✅ Output: `dist/index.js` (36KB)
- ✅ No type errors
- ✅ No dependency issues

### Quick Verification (5 Tests)

Run quick smoke test: `/mcp-server/QUICK_TEST.md`

**Tests:**

1. Platform overview shows ExperiGen philosophy
2. Non-standard domain triggers warning
3. Standard domain has no warning
4. Datasets show extractability info
5. Formulate-hypothesis prompt has examples

**Expected Pass Rate:** 5/5 (100%)

### Comprehensive Testing (28 Tests)

Full test suite: `/mcp-server/TESTING_GUIDE.md`

**Phases:**

- A: Infrastructure (2 tests)
- B: Domain Flexibility (5 tests)
- C: ExperiGen Philosophy (6 tests)
- D: Workflows (6 tests)
- E: Diverse Sampling (2 tests)
- F: Edge Cases (5 tests)
- G: Tool Precision (2 tests)

**Time Estimate:** ~2 hours for complete suite

---

## How to Test

### Option 1: MCP Inspector (Quickest)

1. **Build:**

   ```bash
   cd /Users/someshsingh/Github/OpenExperiments/mcp-server
   npm run build
   ```

2. **Start Dev Server (separate terminal):**

   ```bash
   cd /Users/someshsingh/Github/OpenExperiments
   npm run dev
   ```

3. **Start Inspector:**

   ```bash
   npx @modelcontextprotocol/inspector node dist/index.js
   ```

4. **Run Quick Test:**
   - Call `platform_overview` → Check for ExperiGen philosophy section
   - Call `generate_submission_url` with `domains: ["attention"]` → Check for warning
   - Call `list_datasets` → Check for extractability info

---

### Option 2: Claude Desktop

1. **Build MCP server** (see above)

2. **Add to config** (`~/Library/Application Support/Claude/claude_desktop_config.json`):

   ```json
   {
     "mcpServers": {
       "openexperiments": {
         "command": "node",
         "args": ["/Users/someshsingh/Github/OpenExperiments/mcp-server/dist/index.js"],
         "env": {
           "OPENEXPERIMENTS_API_URL": "http://localhost:3000"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

4. **Test in conversation:**
   ```
   Call the platform_overview tool and show me the philosophy section
   ```

---

### Option 3: Claude Code

1. **Build MCP server** (see above)

2. **Configure:**

   ```bash
   claude mcp add openexperiments node /Users/someshsingh/Github/OpenExperiments/mcp-server/dist/index.js
   ```

3. **Set environment variable** in `~/.claude/settings.json`:

   ```json
   {
     "mcpServers": {
       "openexperiments": {
         "command": "node",
         "args": ["/Users/someshsingh/Github/OpenExperiments/mcp-server/dist/index.js"],
         "env": {
           "OPENEXPERIMENTS_API_URL": "http://localhost:3000"
         }
       }
     }
   }
   ```

4. **Start new session and test**

---

## Expected Outcomes

### For Users (Claude as User)

**Before Update:**

- Domain restricted to enum → schema errors for "attention", "learning", etc.
- No guidance on feature extractability
- Users couldn't distinguish testable from non-testable hypotheses
- No explanation of how features are extracted

**After Update:**

- Domain accepts any string → exploration in any domain
- Clear extractability guidance throughout
- Users understand: "Can this be extracted from available columns?"
- Examples: ✅ brightness from pixels, ❌ viewer's mood
- Non-standard domains → helpful warning with GitHub process

### For Developers

**Code Quality:**

- ✅ More flexible domain handling
- ✅ No breaking changes
- ✅ Backward compatible
- ✅ Clear documentation

**User Experience:**

- ✅ Educational: teaches ExperiGen philosophy
- ✅ Actionable: warns about domain restrictions with next steps
- ✅ Comprehensive: extractability guidance everywhere relevant

---

## Success Criteria

Implementation is successful if:

### Core Functionality

- ✅ All 10 tools callable without errors
- ✅ Both prompts load with full context
- ✅ Resource accessible

### Domain Flexibility

- ✅ Tools accept any domain string (no enum validation errors)
- ✅ Non-standard domains trigger appropriate warnings
- ✅ Standard domains work without warnings

### ExperiGen Philosophy

- ✅ Extractability explained in platform_overview
- ✅ All datasets show extractable features
- ✅ Prompts include ✅/❌ examples
- ✅ Users can distinguish testable from non-testable

### User Experience

- ✅ Tool call efficiency (≤ 6 calls per workflow)
- ✅ Clear, actionable guidance
- ✅ No hallucinated datasets
- ✅ Graceful error handling

**Overall Pass Rate Target:** ≥ 90% of test cases

---

## Known Limitations

1. **Extractability Maps are Hardcoded**
   - Currently: 4 hardcoded dataset extractability descriptions
   - Future: Should be stored in database schema (coming soon per user feedback)
   - Workaround: Update maps in `src/index.ts` when datasets change

2. **Backend Domain Validation**
   - MCP accepts any domain, but backend restricts to standard domains
   - This is intentional: enables exploration, guides submission process
   - Users must follow GitHub PR process for new domains

3. **Diverse Sampling Depends on Data**
   - Hypothesis sampling shows diverse domains IF they exist in DB
   - With fresh/small DB, diversity may be limited
   - This is expected behavior, not a bug

---

## Next Steps

### Immediate (Before Merging)

1. ✅ Implementation complete
2. ✅ Build successful
3. ✅ Documentation complete
4. [ ] Run quick smoke test (15 min)
5. [ ] Fix any critical issues found
6. [ ] Run full test suite (2 hours)
7. [ ] Record test results in `test-logs/`
8. [ ] Update README.md with v1.1.0 notes

### Post-Merge

1. Deploy to production MCP server
2. Update public documentation
3. Announce feature to users (newsletter, Discord, etc.)
4. Monitor for user feedback on extractability guidance
5. Track metrics: domain diversity in submissions, testability rate

### Future Enhancements

1. Move extractability maps to database schema
2. Add extractability validation in backend API
3. Create automated tests for MCP server
4. Add more ✅/❌ examples based on user feedback
5. Integrate with VLM/LLM feature extraction pipelines

---

## Questions or Issues?

- See testing guides: `TESTING_GUIDE.md` or `QUICK_TEST.md`
- Check compatibility: `MIGRATION_COMPATIBILITY.md`
- Review implementation: `src/index.ts` (lines as documented above)

---

**Implementation Status:** ✅ COMPLETE
**Ready for Testing:** ✅ YES
**Ready for Production:** ⏳ PENDING TEST RESULTS
