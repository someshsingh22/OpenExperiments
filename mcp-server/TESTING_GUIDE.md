# MCP Server Testing Guide

## Overview

This guide provides comprehensive testing procedures for the OpenExperiments MCP server updates that implement:

1. **Domain flexibility** - Accepting any domain string (not just "persuasion" and "memorability")
2. **ExperiGen philosophy** - Feature extractability guidance throughout

## Prerequisites

### 1. Build the MCP Server

```bash
cd /Users/someshsingh/Github/OpenExperiments/mcp-server
npm run build
```

### 2. Start Local Development Server

In a separate terminal:

```bash
cd /Users/someshsingh/Github/OpenExperiments
npm run dev
```

Server should be running at `http://localhost:3000`

### 3. Configure MCP Server

**Option A: MCP Inspector (Quick Testing)**

```bash
npx @modelcontextprotocol/inspector node /Users/someshsingh/Github/OpenExperiments/mcp-server/dist/index.js
```

**Option B: Claude Desktop (Full Integration)**

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

**Option C: Claude Code**

```bash
claude mcp add openexperiments node /Users/someshsingh/Github/OpenExperiments/mcp-server/dist/index.js
```

Or manually edit `~/.claude/settings.json`:

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

---

## Test Suite

### Phase A: Infrastructure Validation (5 min)

#### A.1 MCP Handshake

**Test:** Verify MCP server connects and lists resources

**Steps:**

1. Start MCP Inspector or Claude Desktop
2. Check that `openexperiments` server appears
3. List available tools

**Expected:**

- 10 tools visible:
  - list_problem_statements
  - list_datasets
  - get_dataset
  - search_hypotheses
  - get_hypothesis
  - get_arena_rankings
  - list_experiments
  - get_experiment
  - platform_overview
  - generate_submission_url
- 2 prompts visible:
  - formulate-hypothesis
  - co-ideate
- 1 resource visible:
  - platform-guide

**Pass Criteria:** ✅ All tools, prompts, and resources listed

---

#### A.2 API Connectivity

**Test:** Call platform_overview to verify backend connection

**Query:**

```
Call platform_overview tool
```

**Expected Output:**

```
# OpenExperiments Platform Overview

An open platform where anyone — humans and AI — can submit...

## Stats
| Metric | Count |
|--------|-------|
| Hypotheses | [number] |
| Problem Statements | [number] |
| Datasets | [number] |
...

## Philosophy: ExperiGen Feature Extractability
**Core Principle**: Hypotheses must test features COMPUTABLE from available data.

**✅ EXTRACTABLE (Testable)**:
- Brightness, contrast, color → extracted from image pixel values
...
```

**Pass Criteria:**

- ✅ Stats load without errors
- ✅ ExperiGen philosophy section present
- ✅ Lists extractable vs non-extractable features

---

### Phase B: Domain Flexibility Testing (15 min)

#### B.1 Accept Non-Standard Domain in search_hypotheses

**Test:** Domain parameter accepts any string (not enum)

**Query:**

```
Call search_hypotheses with query="face" and domain="attention"
```

**Expected:**

- ✅ No schema validation error about domain enum
- ✅ Tool call succeeds
- ✅ Returns results (may be empty if no "attention" hypotheses exist)

---

#### B.2 Accept Non-Standard Domain in list_datasets

**Test:** Filter datasets by custom domain

**Query:**

```
Call list_datasets with domain="learning"
```

**Expected:**

- ✅ No schema validation error
- ✅ Tool call succeeds
- ✅ Filters to datasets matching "learning" domain

---

#### B.3 Generate URL with Non-Standard Domain

**Test:** Create submission URL with custom domain and verify warning

**Query:**

```
Call generate_submission_url with:
- statement: "Animated GIFs increase engagement"
- rationale: "Motion captures attention"
- domains: ["attention"]
- customProblemStatement: "What captures viewer attention?"
```

**Expected Output:**

```
## Ready to Submit

Pre-filled submission link:
[URL with encoded params]

### Summary
- Statement: Animated GIFs increase engagement
- Rationale: Motion captures attention
- Problem: What captures viewer attention?
- Domains: attention
- Source: human

---

⚠️  **Domain Submission Note**

Your hypothesis uses: **attention**

The platform currently accepts hypotheses in these domains through
the web UI, but the domain field will be restricted to standard options...

To propose "attention" as a new official domain:
1. Open an issue at [site]/issues (GitHub link in footer)
2. Describe the domain and why it's valuable
...
```

**Pass Criteria:**

- ✅ URL generated successfully
- ✅ Warning section appears
- ✅ Lists "attention" as non-standard
- ✅ Provides actionable next steps

---

#### B.4 Standard Domain (No Warning)

**Test:** Verify standard domains don't trigger warning

**Query:**

```
Call generate_submission_url with:
- statement: "Faces increase memorability"
- rationale: "Faces are salient"
- domains: ["memorability"]
- problemStatementId: "ps-2"
```

**Expected:**

- ✅ URL generated successfully
- ✅ **No warning section** (memorability is standard)

---

#### B.5 Multiple Domains (Mixed Standard/Non-Standard)

**Test:** Warning lists only non-standard domains

**Query:**

```
Call generate_submission_url with:
- domains: ["memorability", "attention", "learning"]
```

**Expected:**

- ✅ Warning appears
- ✅ Lists only "attention, learning" as non-standard
- ✅ Does not mention "memorability"

---

### Phase C: ExperiGen Philosophy Communication (20 min)

#### C.1 Platform Overview Philosophy

**Test:** Verify comprehensive ExperiGen explanation

**Query:**

```
Call platform_overview
```

**Expected in output:**

- ✅ Section: "## Philosophy: ExperiGen Feature Extractability"
- ✅ "Core Principle: Hypotheses must test features COMPUTABLE from available data"
- ✅ **Extractable examples:**
  - Brightness from pixels
  - Sentiment from text
  - Face count from VLMs
  - Duration from timestamps
- ✅ **Non-extractable examples:**
  - Viewer's mood
  - Author's intent
  - Cultural significance
  - Temporal trends (if no timestamp)
  - User demographics (if anonymized)
- ✅ "Domains: Start with persuasion or memorability, or PROPOSE NEW domains!"

---

#### C.2 Dataset Extractability Info

**Test:** Verify each dataset shows extractable features

**Query:**

```
Call list_datasets
```

**Expected for each dataset:**

**ds-1 (Reddit CMV):**

- ✅ "Extractable Features: Text sentiment, length, readability, named entities (NLP); User karma, post history (if not anonymized); Temporal patterns (from timestamp)"

**ds-2 (LaMem):**

- ✅ "Extractable Features: Image brightness, contrast, color distribution, dominant colors (pixel analysis); Face count, object types, scene category (VLM); Composition features (rule of thirds, focal points)"

**ds-3 (Twitter Persuasion Pairs):**

- ✅ "Extractable Features: Tweet sentiment, hashtags, mentions, length; Engagement metrics (retweets, likes)"

**ds-4 (Visual Attention):**

- ✅ "Extractable Features: Same as LaMem + attention map gaze patterns, fixation duration"

---

#### C.3 Get Dataset Detail

**Test:** Detailed extractability with ❌ examples

**Query:**

```
Call get_dataset with datasetId="ds-3"
```

**Expected Output:**

```
# Twitter Persuasion Pairs

- HuggingFace: [url]
- Domain: persuasion
- Task: Studying persuasive communication in short-form social media
- Columns: tweet_text, reply_text, likes, retweets, persuasion_score
- Target: persuasion_score

**Extractable Features**:
• Image: brightness, contrast, color distribution, dominant colors
• Objects: face count, object types, scene category (via VLM)
• Engagement: retweet counts, like counts
• ❌ Cannot extract: sarcasm (unreliable), user demographics (if anonymized)

## Problem Statements (X)
...
```

**Pass Criteria:**

- ✅ Extractable features listed with methods
- ✅ "❌ Cannot extract" section present
- ✅ Clear distinction between what can/cannot be computed

---

#### C.4 Formulate-Hypothesis Prompt Philosophy

**Test:** Comprehensive extractability guidance in prompt

**Query:**

```
Use formulate-hypothesis prompt
```

**Expected in context:**

**Section: "What Makes a Good Hypothesis (ExperiGen Philosophy)"**

- ✅ "1. Feature Extractability — Tests a feature COMPUTABLE from data"
- ✅ Example with ✅: "Warm colors increase image memorability → Color extractable from RGB pixel values (code-based)"
- ✅ Example with ✅: "Longer arguments are more persuasive → Length extractable from text character count"
- ✅ Example with ✅: "Images with faces are more memorable → Face presence extractable via VLM"
- ✅ Example with ✅: "Positive sentiment increases persuasiveness → Sentiment extractable from text via NLP/LLM"
- ✅ Example with ❌: "Viewer's mood affects memory → Mood NOT in dataset (would need surveys)"
- ✅ Example with ❌: "Arguments posted at night are less persuasive → Temporal feature needs timestamp field (check if exists!)"

**Section: "Available Datasets (What Can Be Extracted?)"**

- ✅ Intro text: "For each dataset, consider what features can be DERIVED using:"
- ✅ Lists extraction methods: Code, NLP/LLM, VLM, Statistical
- ✅ Key question: "Can I compute this feature from the available columns?"

**Section: "Your Workflow"**

- ✅ Step 2: "Identify extractable features from available datasets"
- ✅ Step 5: "Explain extraction method — EXACTLY how the feature would be extracted"
- ✅ Examples: "We'd extract brightness using code to read pixel RGB values"

---

#### C.5 Co-Ideate Prompt

**Test:** Extractability emphasis in brainstorming

**Query:**

```
Use co-ideate prompt with domain="memorability"
```

**Expected in context:**

- ✅ "Explore ANY domain—not just persuasion/memorability"
- ✅ Lists extraction types: "Code-based: brightness, length, counts"
- ✅ Step 4: "Check extractability — Can the feature be computed from existing data?"
- ✅ Step 5: "Propose new domains — Beyond persuasion/memorability"
- ✅ Suggests: "attention, learning, memory consolidation, decision-making, perception"

---

#### C.6 Platform Guide Resource

**Test:** ExperiGen philosophy in static resource

**Query:**

```
Read resource: platform-guide (openexperiments://guide)
```

**Expected in content:**

- ✅ Section: "## ExperiGen Philosophy: Feature Extractability"
- ✅ "Core principle: Hypotheses test features COMPUTABLE from existing data"
- ✅ Lists extractable examples with methods
- ✅ Lists non-extractable examples with reasons
- ✅ "Think: Can I compute this using the available columns + AI/code?"
- ✅ "Domains" section includes: "[Propose New]: Attention, learning, memory..."

---

### Phase D: Workflow Testing (30 min)

#### D.1 Testable Feature Hypothesis (Standard Domain)

**Test:** End-to-end workflow for extractable feature

**User Query:**

```
"I think warm colors make images more memorable"
```

**Expected Claude Flow:**

1. ✅ Calls `list_datasets` or `get_dataset` (ds-3)
2. ✅ Identifies: "Color extractable from RGB pixel values"
3. ✅ Calls `search_hypotheses` with query="color"
4. ✅ Finds existing hypothesis h-10 (if exists), mentions it
5. ✅ Explains extraction method clearly
6. ✅ Helps formulate refined hypothesis
7. ✅ Calls `generate_submission_url` with domains=["memorability"]
8. ✅ URL generated, no warning

**Quality Checks:**

- ✅ Total tool calls ≤ 6
- ✅ Extractability explained before formulation
- ✅ Duplicate detection attempted
- ✅ URL pre-fills correctly

---

#### D.2 Testable Feature (Non-Standard Domain)

**Test:** New domain with extractable feature

**User Query:**

```
"I think larger fonts improve text learning retention"
```

**Expected Claude Flow:**

1. ✅ Calls `platform_overview` or `list_datasets`
2. ✅ Recognizes "learning" as new domain
3. ✅ Checks if any dataset has text with font sizes
4. ✅ If no dataset: clearly states gap
5. ✅ Suggests: "We could test this if you find/propose a dataset"
6. ✅ Helps formulate hypothesis anyway
7. ✅ Calls `generate_submission_url` with domains=["learning"]
8. ✅ **Warning appears** about non-standard domain
9. ✅ Warning includes GitHub issue process

**Quality Checks:**

- ✅ Claude doesn't hallucinate matching dataset
- ✅ Extractability reasoning sound (font size from text metadata)
- ✅ Gap communicated clearly
- ✅ Hypothesis can still be formulated

---

#### D.3 Non-Extractable Feature

**Test:** Identifies feature that cannot be computed

**User Query:**

```
"I think the viewer's mood affects image memorability"
```

**Expected Claude Flow:**

1. ✅ Calls `list_datasets` (ds-3 or ds-4)
2. ✅ Reviews extractability info
3. ✅ Identifies: "Mood not stored in dataset fields"
4. ✅ Explains: "This would require survey data collection"
5. ✅ Suggests alternatives:
   - "Test emotional content of images (extractable)"
   - "Test facial expressions (extractable via VLM)"
6. ✅ Offers to help reformulate with extractable proxy
7. ✅ Does NOT generate submission URL for non-testable hypothesis

**Quality Checks:**

- ✅ Correctly identifies non-extractability
- ✅ References dataset schema/fields
- ✅ Suggests practical alternatives
- ✅ Educational tone (helps user understand why)

---

#### D.4 Ambiguous Extractability

**Test:** Conditional feature (depends on data availability)

**User Query:**

```
"I think arguments posted at night are less persuasive"
```

**Expected Claude Flow:**

1. ✅ Calls `get_dataset` with datasetId="ds-1"
2. ✅ Checks schema for timestamp field
3. ✅ Reviews extractability info mentioning "temporal patterns"
4. ✅ Explains conditional logic:
   - If timestamp exists: "Temporal features extractable from timestamp"
   - If no timestamp: "This requires timestamp data, check if available"
5. ✅ Verifies data availability before committing

**Quality Checks:**

- ✅ Doesn't assume extractability
- ✅ Checks actual dataset schema
- ✅ Conditional reasoning is sound

---

#### D.5 Co-Ideation to Formulation

**Test:** Brainstorm gaps → formulate new hypothesis

**User Query:**

```
"What new hypotheses could we test about memorability?"
```

**Expected Claude Flow:**

1. ✅ Uses `co-ideate` prompt or calls `search_hypotheses`
2. ✅ Lists existing hypotheses (faces, color, violations, focal points)
3. ✅ Identifies gaps with extractability filter:
   - Texture (extractable via image analysis)
   - Motion blur (extractable from images)
   - Semantic incongruity beyond faces (extractable via VLM)
4. ✅ Proposes 2-3 specific novel hypotheses
5. ✅ All suggestions are extractable
6. ✅ User picks one
7. ✅ Smooth transition to formulation
8. ✅ Calls `generate_submission_url`

**Quality Checks:**

- ✅ Gap analysis accurate
- ✅ No duplicate suggestions
- ✅ All suggestions testable with existing data
- ✅ Extractability explained for each

---

#### D.6 No Dataset Exists

**Test:** Handle domain with no available data

**User Query:**

```
"I think video thumbnails with text overlays get more clicks"
```

**Expected Claude Flow:**

1. ✅ Calls `list_datasets`
2. ✅ Recognizes: no video/CTR datasets
3. ✅ States clearly: "No dataset covers video thumbnails or click-through rates"
4. ✅ Suggests: "Find dataset on Hugging Face or propose via GitHub PR"
5. ✅ Offers to help formulate hypothesis for future
6. ✅ If user still wants URL: generates with warning about data gap

**Quality Checks:**

- ✅ No hallucinated dataset
- ✅ Gap communicated clearly
- ✅ Actionable next steps
- ✅ Can formulate for future (optimistic)

---

### Phase E: Diverse Sampling Verification (10 min)

#### E.1 Hypothesis Sampling in Formulate-Hypothesis

**Test:** Check that prompt loads diverse hypotheses

**Query:**

```
Use formulate-hypothesis prompt
```

**Expected Behavior:**

1. ✅ Loads 30 hypotheses (API call limit)
2. ✅ Filters: `phase='completed'` AND `arenaElo > 1400`
3. ✅ Samples max 2 per domain
4. ✅ Shows up to 8 total
5. ✅ If multiple domains exist, representation is diverse

**Verification Method:**

- Inspect API call in MCP Inspector: `GET /api/hypotheses?sort=top_rated&limit=30`
- Check that sampled hypotheses show varied domains in output
- If DB has hypotheses from multiple domains, they should appear

---

#### E.2 Empty Database Handling

**Test:** Graceful handling when no hypotheses exist

**Prerequisites:** Temporarily clear hypothesis table or use fresh DB

**Query:**

```
Use formulate-hypothesis prompt
```

**Expected:**

- ✅ Shows: "(No completed hypotheses available yet — be the first!)"
- ✅ Doesn't crash
- ✅ Rest of prompt loads normally

---

### Phase F: Edge Cases & Error Handling (10 min)

#### F.1 API Unreachable

**Test:** Error handling when backend is down

**Setup:** Stop local dev server (`npm run dev`)

**Query:**

```
Call platform_overview
```

**Expected:**

- ✅ Clear error message about API connectivity
- ✅ Message includes: "Cannot reach OpenExperiments API at http://localhost:3000"
- ✅ Doesn't crash Claude session

**Cleanup:** Restart dev server

---

#### F.2 Invalid Hypothesis ID

**Test:** Error handling for non-existent resource

**Query:**

```
Call get_hypothesis with hypothesisId="h-99999"
```

**Expected:**

- ✅ Error message: "API 404 on /api/hypotheses/h-99999"
- ✅ Doesn't crash

---

#### F.3 Special Characters in Submission

**Test:** URL encoding of special characters

**Query:**

```
Call generate_submission_url with:
- statement: 'Test "quotes" and (parens) & symbols'
- rationale: "Testing special chars: <> [] {}"
```

**Expected:**

- ✅ URL generated successfully
- ✅ Special characters URL-encoded
- ✅ Copy URL to browser, open submit page
- ✅ Form pre-fills with original text (decoded)

**Manual Verification:**

- Open generated URL in browser
- Check form fields contain correct unencoded text

---

#### F.4 Very Long Rationale

**Test:** Handle rationale exceeding typical URL length

**Query:**

```
Call generate_submission_url with rationale of 2000+ characters
```

**Expected:**

- ✅ URL still generates
- ✅ Note appears: "The rationale is long (2000+ chars). If the link doesn't load fully..."
- ✅ URL may be truncated by browser, but doesn't error

---

#### F.5 Multiple Domains with Mixed Standard/Non-Standard

**Test:** Warning lists only non-standard

**Query:**

```
Call generate_submission_url with:
- domains: ["memorability", "attention", "persuasion", "learning"]
```

**Expected:**

- ✅ URL generated
- ✅ Warning appears
- ✅ Lists only: "attention, learning"
- ✅ Does not mention "memorability" or "persuasion"

---

### Phase G: Tool Precision Testing (10 min)

#### G.1 Correct Tool Selection

**Test Case 1:** "What datasets are available?"

- ✅ Claude calls `list_datasets` (not `platform_overview`)

**Test Case 2:** "Show me hypothesis h-5 in detail"

- ✅ Claude calls `get_hypothesis` (not `search_hypotheses`)

**Test Case 3:** "Find hypotheses about faces"

- ✅ Claude calls `search_hypotheses` with query="faces"

**Test Case 4:** "What's the current state of the platform?"

- ✅ Claude calls `platform_overview`

---

#### G.2 Tool Call Efficiency

**Test:** Verify minimal tool calls for workflow D.1

**User Query:** "I think warm colors make images more memorable"

**Expected Tool Calls (≤ 6 total):**

1. `list_datasets` or `get_dataset`
2. `search_hypotheses` (duplicate check)
3. `generate_submission_url`

**Quality Check:**

- ✅ No redundant calls
- ✅ Uses parallel calls when possible
- ✅ Workflow completes in ≤ 6 tool invocations

---

## Success Criteria

Test suite passes if:

### Core Functionality

- ✅ All 10 tools callable without schema errors
- ✅ Both prompts load with full context
- ✅ Resource accessible
- ✅ API connectivity stable

### Domain Flexibility

- ✅ Tools accept any domain string (no enum errors)
- ✅ Non-standard domain warnings appear correctly
- ✅ Standard domains don't trigger warnings

### ExperiGen Philosophy

- ✅ Extractability explained in `platform_overview`
- ✅ All datasets show extractable features
- ✅ `formulate-hypothesis` prompt has complete examples
- ✅ `co-ideate` prompt mentions extractability
- ✅ `platform-guide` resource includes philosophy

### Feature Extractability Guidance

- ✅ Users can distinguish extractable vs non-extractable
- ✅ Examples cover code-based, LLM, VLM extraction
- ✅ ❌ examples clearly state what's NOT extractable
- ✅ Conditional extractability handled

### Workflows

- ✅ Testable hypotheses → formulation → URL generation
- ✅ Non-extractable features → explanation → alternatives
- ✅ No dataset exists → gap acknowledged → GitHub PR suggested
- ✅ New domains → graceful handling → warning with next steps

### Quality Metrics

- ✅ Tool call efficiency (workflows ≤ 6 calls)
- ✅ Response time acceptable (< 10s)
- ✅ Duplicate detection works
- ✅ Dataset matching accurate
- ✅ URL generation + pre-filling works

### Error Handling

- ✅ API unreachable → clear error
- ✅ Invalid IDs → helpful error
- ✅ Special characters → proper encoding
- ✅ Empty results → graceful handling

**Overall Pass Rate:** ≥ 90% of test cases passing

---

## Recording Test Results

Use the provided test result templates in `test-logs/` directory:

- `test-A-infrastructure.md`
- `test-B-domain-flexibility.md`
- `test-C-experigen-philosophy.md`
- `test-D-workflows.md`
- `test-E-sampling.md`
- `test-F-edge-cases.md`
- `test-G-tool-precision.md`

Fill in:

- Actual behavior observed
- Screenshots (if applicable)
- Pass/Fail/Partial status
- Notes on issues or improvements

---

## Troubleshooting

### MCP Server Not Connecting

- Check build: `npm run build` in `mcp-server/`
- Check path in config matches actual file location
- Check Node version: `node --version` (need v18+)
- Check logs in Claude Desktop/Code

### API Errors

- Verify dev server running: `curl http://localhost:3000/api/hypotheses`
- Check env var: `OPENEXPERIMENTS_API_URL=http://localhost:3000`
- Check CORS if using different origin

### Schema Validation Errors

- If enum errors still occur, rebuild: `npm run build`
- Check `dist/index.js` has latest changes
- Restart Claude Desktop/Code after config changes

### Tools Not Listed

- Restart Claude Desktop/Code
- Check MCP server config path is absolute
- Check JSON syntax in config file

---

## Next Steps After Testing

**If pass rate ≥ 90%:**

1. ✅ Update `MIGRATION_COMPATIBILITY.md` with results
2. ✅ Add passing test logs to `mcp-server/test-logs/`
3. ✅ Update `README.md` with "Last Tested" timestamp
4. ✅ Consider testing phase complete

**If pass rate < 90%:**

1. Review failed test cases in detail
2. Identify root causes (tool description, schema, prompt wording)
3. Make targeted fixes to `mcp-server/src/index.ts`
4. Rebuild: `npm run build`
5. Re-run failed test cases
6. Iterate until pass rate ≥ 90%

---

## Continuous Improvement

- Add new test cases when users report issues
- Update extractability maps when datasets change
- Refine prompts based on user feedback
- Track metrics over time to measure quality trends

---

**Testing Time Estimate:** ~2 hours for complete suite
**Quick Smoke Test:** 15 minutes (Phases A, B.3, C.1, D.1)
