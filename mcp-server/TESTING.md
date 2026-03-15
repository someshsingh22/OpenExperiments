# OpenExperiments MCP Server — Testing Plan

## Phase 1: Build Verification

### 1.1 Install & Compile

```bash
cd mcp-server
npm install
npm run build
```

- [ ] `npm install` completes without errors
- [ ] `npm run build` produces `dist/index.js` without TypeScript errors
- [ ] `dist/index.js` starts with `#!/usr/bin/env node`

### 1.2 Server Starts

```bash
# Should start and wait for stdio input (Ctrl+C to exit)
node dist/index.js
```

- [ ] No crash on startup
- [ ] Process stays alive (waiting for MCP messages over stdio)

### 1.3 MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

- [ ] Inspector connects successfully
- [ ] All 10 tools listed
- [ ] Both prompts listed
- [ ] Resource `openexperiments://guide` listed

---

## Phase 2: Individual Tool Testing

Run each tool via MCP Inspector or Claude Desktop. For each, verify the
response is well-formed and contains expected data.

**Prerequisites:** Either the production API must be reachable, or run the
local dev server (`npm run dev` in the main project) and set
`OPENEXPERIMENTS_API_URL=http://localhost:3000`.

### 2.1 platform_overview

- [ ] Returns hypothesis count, problem statement count, dataset count
- [ ] Status breakdown matches what's in the DB
- [ ] Phase breakdown is correct
- [ ] Domains listed (persuasion, memorability)

### 2.2 list_problem_statements

- [ ] Returns all problem statements (currently 4)
- [ ] Each has id, domain, hypothesisCount, description
- [ ] Datasets field present (linked datasets listed, or "None" noted)

### 2.3 list_datasets

- [ ] Returns all datasets (currently 4)
- [ ] Each has column names, target column, HuggingFace URL
- [ ] Domain filter works: `{ domain: "persuasion" }` returns only persuasion datasets
- [ ] Domain filter works: `{ domain: "memorability" }` returns only memorability datasets

### 2.4 get_dataset

- [ ] `{ datasetId: "ds-1" }` returns Reddit ChangeMyView details
- [ ] Linked problem statements listed
- [ ] Experiments using this dataset listed
- [ ] Invalid ID returns clear error message

### 2.5 search_hypotheses

- [ ] `{ query: "persuasive" }` returns relevant hypotheses
- [ ] `{ query: "color" }` returns h-10 (warm color palettes)
- [ ] `{ query: "nonexistent_term_xyz" }` returns empty results gracefully
- [ ] Domain filter narrows results correctly
- [ ] Phase filter works
- [ ] Status filter works
- [ ] Limit param respected

### 2.6 get_hypothesis

- [ ] `{ hypothesisId: "h-1" }` returns full details
- [ ] Experiments section populated (exp-1, exp-2)
- [ ] Comments section populated
- [ ] Citations listed
- [ ] Related hypothesis IDs listed
- [ ] Invalid ID returns clear error

### 2.7 get_arena_rankings

- [ ] Returns ranked list of completed hypotheses
- [ ] Win rates are numbers
- [ ] Ordered by descending win rate

### 2.8 list_experiments

- [ ] No filter: returns all experiments (currently 8)
- [ ] `{ hypothesisId: "h-1" }` returns exp-1 and exp-2
- [ ] Results section present for completed experiments
- [ ] p-value, effect size, sample size, CI all present

### 2.9 get_experiment

- [ ] `{ experimentId: "exp-1" }` returns full details
- [ ] Methodology text present
- [ ] Results present with all statistical fields
- [ ] Linked hypothesis info present

### 2.10 generate_submission_url

- [ ] Generates a valid URL
- [ ] URL contains encoded statement, rationale, domains
- [ ] Opening the URL in a browser loads the submit page
- [ ] Form fields are pre-filled correctly
- [ ] Problem statement ID pre-selects the right dropdown option
- [ ] Custom problem statement shows the text input mode
- [ ] Domains are pre-selected
- [ ] Source "ai_agent" sets generator type to "AI"
- [ ] Very long rationale (>1500 chars) shows the warning note

---

## Phase 3: End-to-End Workflow Testing

Test complete user journeys with Claude (Desktop or Code).

### Workflow A: Hypothesis Formulation (The Core Flow)

**Scenario:** User has a vague idea about persuasion.

```
User: "I think questions are more persuasive than statements in arguments"
```

**Expected LLM behavior:**
1. Calls `list_problem_statements` to see active research areas
2. Calls `list_datasets` to understand available data
3. Calls `search_hypotheses` with "question" to check for duplicates
4. Helps refine: "Questions that reframe the issue as a dilemma are more
   persuasive than declarative counterarguments" (or similar)
5. Explains which dataset can test this (Reddit CMV — has reply text)
6. Calls `generate_submission_url` with the finalized hypothesis
7. User gets a clickable link to `/submit` with pre-filled form

**Evaluate:**
- [ ] LLM correctly identifies relevant problem statements
- [ ] LLM correctly identifies which dataset(s) apply
- [ ] LLM checks for duplicate hypotheses
- [ ] Generated hypothesis is specific and falsifiable
- [ ] Submission URL works and pre-fills correctly
- [ ] Total tool calls <= 6 (efficient usage)

### Workflow B: No Dataset Exists

**Scenario:** User wants to test something outside current domains.

```
User: "I think video thumbnails with text overlays get more clicks"
```

**Expected LLM behavior:**
1. Calls `list_problem_statements` and `list_datasets`
2. Recognizes no dataset covers video thumbnails or click-through rates
3. Clearly tells the user: no suitable dataset exists
4. Suggests: raise a request on GitHub to add a relevant dataset
5. Optionally: still helps frame the hypothesis for when data becomes available

**Evaluate:**
- [ ] LLM does NOT hallucinate a matching dataset
- [ ] LLM clearly communicates the gap
- [ ] LLM provides actionable next step (GitHub link)

### Workflow C: Co-Ideation

**Scenario:** User wants brainstorming help.

```
User: "What hasn't been explored in memorability yet?"
```

**Expected LLM behavior:**
1. Uses `co-ideate` prompt or calls `search_hypotheses` with domain filter
2. Lists what HAS been tested (faces, color, focal points, physical violations)
3. Identifies gaps (texture, emotional content, cultural context, motion blur,
   spatial frequency, semantic incongruity beyond faces, etc.)
4. Proposes 2-3 specific new directions
5. Helps develop the user's preferred direction into a hypothesis

**Evaluate:**
- [ ] LLM accurately summarizes existing coverage
- [ ] Suggestions are genuinely novel (not duplicates)
- [ ] Suggestions are testable with available datasets (LaMem, Visual Attention)

### Workflow D: Research Exploration

**Scenario:** User wants to understand what's been done.

```
User: "Show me the most successful hypotheses about persuasion"
```

**Expected LLM behavior:**
1. Calls `search_hypotheses` or `get_arena_rankings`
2. Presents top-rated persuasion hypotheses
3. For the top one (h-1), calls `get_hypothesis` for full detail
4. Summarizes the evidence landscape

**Evaluate:**
- [ ] Correct data presented
- [ ] Statistical results accurately conveyed
- [ ] LLM doesn't misinterpret p-values or effect sizes

### Workflow E: Experiment Design Help

**Scenario:** User wants to run an experiment on an existing hypothesis.

```
User: "How should I test hypothesis h-5 (statistics vs anecdotes)?"
```

**Expected LLM behavior:**
1. Calls `get_hypothesis` for h-5
2. Calls `list_experiments` for similar hypotheses (h-1, h-4, h-8)
3. Reviews past methodologies (logistic regression on CMV data, LLM annotation)
4. Suggests a methodology: annotate CMV replies for statistical evidence
   presence, run logistic regression controlling for known confounds
5. Recommends the Reddit CMV dataset (ds-1)

**Evaluate:**
- [ ] LLM references past experiment methodologies
- [ ] Suggested methodology is sound
- [ ] Correct dataset recommended

---

## Phase 4: Prompt Quality Evaluation

### 4.1 Formulate-Hypothesis Prompt

Run the prompt 5 times with different ideas. For each, score (1-5):

| Criteria | Score |
|----------|-------|
| Correctly identifies relevant problem statement | /5 |
| Correctly identifies relevant dataset(s) | /5 |
| Checks for duplicate hypotheses | /5 |
| Generated hypothesis is specific/falsifiable | /5 |
| Rationale is well-grounded | /5 |
| Correctly handles "no dataset" case | /5 |
| Generates working submission URL | /5 |

**Test ideas:**
1. "Longer arguments are more persuasive" (partially overlaps with existing)
2. "Symmetry makes images memorable" (testable with LaMem)
3. "Sarcasm hurts persuasion" (testable with CMV)
4. "3D objects are more memorable" (edge case — may lack data)
5. "Arguments with analogies change minds" (novel angle)

### 4.2 Co-Ideate Prompt

Run 3 times. Evaluate:

- [ ] Accurately summarizes existing research landscape
- [ ] Identifies genuine gaps (not things already tested)
- [ ] Suggestions are grounded in available data
- [ ] Moves naturally from brainstorm to formulation

---

## Phase 5: Edge Cases

### 5.1 API Unreachable

```bash
OPENEXPERIMENTS_API_URL=http://localhost:9999 node dist/index.js
```

- [ ] Tools return clear error: "Cannot reach OpenExperiments API"
- [ ] Server stays alive (doesn't crash)

### 5.2 Empty Database

Test against a fresh database with no seed data:

- [ ] `list_problem_statements` returns empty list gracefully
- [ ] `search_hypotheses` returns "0 results" not an error
- [ ] `platform_overview` shows all zeros
- [ ] Prompts still work (just with empty context)

### 5.3 Special Characters

- [ ] Search with quotes: `{ query: "\"persuasive\"" }`
- [ ] Search with unicode: `{ query: "persuasion" }` (standard)
- [ ] Submission URL with special chars in statement (parentheses, quotes)

### 5.4 Large Results

- [ ] `search_hypotheses` with limit=100 — still responds within 10s
- [ ] `platform_overview` with many hypotheses — aggregation correct

---

## Phase 6: Iteration Playbook

After running Phases 1-5, use this process to improve:

### Tool Descriptions
If the LLM calls the wrong tool or doesn't call a tool when it should:
1. Note which tool should have been called and what was called instead
2. Update the tool's `description` string to be more specific about when to use it
3. Re-test the failing workflow

### Prompt Context
If the formulation prompt produces weak hypotheses:
1. Add more examples (especially edge cases that failed)
2. Make the "What Makes a Good Hypothesis" section more specific
3. Add negative examples ("Do NOT generate hypotheses like...")
4. Consider adding the top 3 experiment methodologies as reference

### Tool Output Format
If the LLM misinterprets tool output:
1. Check if the output format is ambiguous
2. Add labels, headers, or separators
3. Consider switching from markdown to structured JSON for that tool

### Missing Tools
If a workflow reveals a need for a tool that doesn't exist:
- Related hypotheses graph traversal
- Citation lookup by DOI
- User profile/contribution history
- Hypothesis comparison (side-by-side)

### Metrics to Track

| Metric | How to Measure |
|--------|---------------|
| Tool call efficiency | Count tool calls per workflow (lower = better) |
| Hypothesis quality | Manual 1-5 rating on specificity, testability, novelty |
| Dataset match accuracy | Does the LLM pick the right dataset? (binary) |
| Duplicate detection | Does the LLM catch overlap? (binary) |
| "No dataset" accuracy | When there's no match, does it say so? (binary) |
| URL correctness | Does the generated URL pre-fill correctly? (binary) |
| Time to hypothesis | Turns from idea to submission URL (lower = better) |
