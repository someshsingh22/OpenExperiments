# MCP Server Test Results

**Date:** [YYYY-MM-DD]
**Tester:** [Name]
**MCP Build:** [commit hash or timestamp]
**Environment:** [MCP Inspector / Claude Desktop / Claude Code]
**API URL:** [http://localhost:3000 or production]

---

## Quick Status

| Phase                   | Total  | Pass | Fail | Partial | Pass Rate |
| ----------------------- | ------ | ---- | ---- | ------- | --------- |
| A: Infrastructure       | 2      |      |      |         |           |
| B: Domain Flexibility   | 5      |      |      |         |           |
| C: ExperiGen Philosophy | 6      |      |      |         |           |
| D: Workflows            | 6      |      |      |         |           |
| E: Sampling             | 2      |      |      |         |           |
| F: Edge Cases           | 5      |      |      |         |           |
| G: Tool Precision       | 2      |      |      |         |           |
| **TOTAL**               | **28** |      |      |         | **%**     |

---

## Phase A: Infrastructure Validation

### A.1 MCP Handshake

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
[Test query]
```

**Expected:**

- [ ] 10 tools listed
- [ ] 2 prompts listed
- [ ] 1 resource listed

**Actual Behavior:**

```
[Paste actual output or describe what happened]
```

**Tool Calls Made:**

```
[List any tool calls]
```

**Screenshots:** [if applicable]

**Notes:**

```
[Any observations]
```

---

### A.2 API Connectivity

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call platform_overview tool
```

**Expected:**

- [ ] Stats load without errors
- [ ] ExperiGen philosophy section present
- [ ] Lists extractable vs non-extractable features

**Actual Behavior:**

```
[Paste output]
```

**Notes:**

```
[Any observations]
```

---

## Phase B: Domain Flexibility Testing

### B.1 Accept Non-Standard Domain (search_hypotheses)

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call search_hypotheses with query="face" and domain="attention"
```

**Expected:**

- [ ] No schema validation error
- [ ] Tool call succeeds
- [ ] Returns results (may be empty)

**Actual Behavior:**

```
[Paste output]
```

**Notes:**

```
[Any observations]
```

---

### B.2 Accept Non-Standard Domain (list_datasets)

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call list_datasets with domain="learning"
```

**Expected:**

- [ ] No validation errors
- [ ] Tool call succeeds

**Actual Behavior:**

```
[Paste output]
```

**Notes:**

```
[Any observations]
```

---

### B.3 Generate URL with Non-Standard Domain (With Warning)

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call generate_submission_url with:
- statement: "Animated GIFs increase engagement"
- rationale: "Motion captures attention"
- domains: ["attention"]
- customProblemStatement: "What captures viewer attention?"
```

**Expected:**

- [ ] URL generated successfully
- [ ] Warning section appears
- [ ] Lists "attention" as non-standard
- [ ] Provides actionable next steps

**Actual Behavior:**

```
[Paste full output including warning]
```

**Notes:**

```
[Verify warning text is clear and actionable]
```

---

### B.4 Standard Domain (No Warning)

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call generate_submission_url with:
- statement: "Faces increase memorability"
- rationale: "Faces are salient"
- domains: ["memorability"]
- problemStatementId: "ps-2"
```

**Expected:**

- [ ] URL generated successfully
- [ ] **No warning section**

**Actual Behavior:**

```
[Paste output - should have no warning]
```

**Notes:**

```
[Confirm no warning for standard domain]
```

---

### B.5 Multiple Domains (Mixed)

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call generate_submission_url with domains: ["memorability", "attention", "learning"]
```

**Expected:**

- [ ] Warning appears
- [ ] Lists only "attention, learning"
- [ ] Does not mention "memorability"

**Actual Behavior:**

```
[Paste warning section]
```

**Notes:**

```
[Verify only non-standard domains in warning]
```

---

## Phase C: ExperiGen Philosophy Communication

### C.1 Platform Overview Philosophy

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call platform_overview
```

**Expected:**

- [ ] "Philosophy: ExperiGen Feature Extractability" section
- [ ] Core principle stated
- [ ] Extractable examples (brightness, sentiment, faces, duration)
- [ ] Non-extractable examples (mood, intent, cultural, temporal if missing)
- [ ] "Propose NEW domains!" mentioned

**Actual Behavior:**

```
[Paste Philosophy section]
```

**Notes:**

```
[Check completeness of examples]
```

---

### C.2 Dataset Extractability Info

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call list_datasets
```

**Expected:**

- [ ] ds-1: Text sentiment, length, readability, named entities...
- [ ] ds-2: Tweet sentiment, hashtags, engagement...
- [ ] ds-3: Image brightness, face count, objects (VLM)...
- [ ] ds-4: Same as LaMem + gaze patterns...

**Actual Behavior:**

```
[Paste extractability info for each dataset]
```

**Notes:**

```
[Verify all 4 datasets have extractability info]
```

---

### C.3 Get Dataset Detail

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call get_dataset with datasetId="ds-3"
```

**Expected:**

- [ ] "Extractable Features" section present
- [ ] Lists extractable features with methods
- [ ] "❌ Cannot extract" section present

**Actual Behavior:**

```
[Paste Extractable Features section]
```

**Notes:**

```
[Check for ❌ examples]
```

---

### C.4 Formulate-Hypothesis Prompt Philosophy

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Use formulate-hypothesis prompt
```

**Expected:**

- [ ] "ExperiGen Philosophy" section in criteria
- [ ] ✅ examples with extraction methods
- [ ] ❌ examples with reasons
- [ ] "Available Datasets (What Can Be Extracted?)" section
- [ ] Workflow emphasizes extraction method explanation

**Actual Behavior:**

```
[Paste relevant sections from prompt context]
```

**Notes:**

```
[Verify examples are clear and diverse]
```

---

### C.5 Co-Ideate Prompt

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Use co-ideate prompt with domain="memorability"
```

**Expected:**

- [ ] "Explore ANY domain" mentioned
- [ ] Lists extraction types (code, LLM, VLM)
- [ ] "Check extractability" in brainstorming steps
- [ ] "Propose new domains" suggested

**Actual Behavior:**

```
[Paste relevant context sections]
```

**Notes:**

```
[Check extractability emphasis]
```

---

### C.6 Platform Guide Resource

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Read resource: platform-guide
```

**Expected:**

- [ ] "ExperiGen Philosophy" section present
- [ ] Extractable examples with methods
- [ ] Non-extractable examples with reasons
- [ ] "Think: Can I compute this..." question
- [ ] Domains section includes "Propose New"

**Actual Behavior:**

```
[Paste Philosophy section from resource]
```

**Notes:**

```
[Verify resource is accessible]
```

---

## Phase D: Workflow Testing

### D.1 Testable Feature (Standard Domain)

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
"I think warm colors make images more memorable"
```

**Expected Flow:**

- [ ] Calls list_datasets or get_dataset
- [ ] Identifies color extractable from RGB
- [ ] Calls search_hypotheses for duplicates
- [ ] Explains extraction method
- [ ] Generates URL with domains=["memorability"]
- [ ] No warning

**Actual Tool Calls:**

```
1. [tool_name with params]
2. [tool_name with params]
...
```

**Claude Response:**

```
[Paste full response]
```

**Quality Checks:**

- [ ] Total tool calls ≤ 6
- [ ] Extractability explained
- [ ] Duplicate detection attempted

**Notes:**

```
[Efficiency, clarity observations]
```

---

### D.2 Testable Feature (Non-Standard Domain)

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
"I think larger fonts improve text learning retention"
```

**Expected Flow:**

- [ ] Recognizes "learning" as new domain
- [ ] Checks for matching dataset
- [ ] States gap if no dataset
- [ ] Suggests finding/proposing dataset
- [ ] Generates URL with warning

**Actual Tool Calls:**

```
[List tool calls]
```

**Claude Response:**

```
[Paste response]
```

**Quality Checks:**

- [ ] Doesn't hallucinate dataset
- [ ] Extractability reasoning sound
- [ ] Warning appears

**Notes:**

```
[How well was gap handled?]
```

---

### D.3 Non-Extractable Feature

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
"I think the viewer's mood affects image memorability"
```

**Expected Flow:**

- [ ] Reviews extractability info
- [ ] Identifies "mood not in dataset"
- [ ] Explains would need surveys
- [ ] Suggests extractable alternatives
- [ ] Does NOT generate URL

**Actual Tool Calls:**

```
[List tool calls]
```

**Claude Response:**

```
[Paste response]
```

**Quality Checks:**

- [ ] Correctly identifies non-extractability
- [ ] Suggests alternatives
- [ ] Educational tone

**Notes:**

```
[Quality of alternatives suggested]
```

---

### D.4 Ambiguous Extractability

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
"I think arguments posted at night are less persuasive"
```

**Expected Flow:**

- [ ] Checks dataset schema for timestamp
- [ ] Conditional reasoning based on availability
- [ ] Verifies before committing

**Actual Tool Calls:**

```
[List tool calls]
```

**Claude Response:**

```
[Paste response]
```

**Quality Checks:**

- [ ] Doesn't assume extractability
- [ ] Checks schema

**Notes:**

```
[Quality of conditional reasoning]
```

---

### D.5 Co-Ideation to Formulation

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
"What new hypotheses could we test about memorability?"
```

**Expected Flow:**

- [ ] Lists existing hypotheses
- [ ] Identifies gaps with extractability filter
- [ ] Proposes 2-3 novel, extractable ideas
- [ ] Smooth transition to formulation

**Actual Tool Calls:**

```
[List tool calls]
```

**Claude Response:**

```
[Paste response]
```

**Quality Checks:**

- [ ] Gap analysis accurate
- [ ] All suggestions extractable
- [ ] No duplicates

**Notes:**

```
[Quality of brainstorming]
```

---

### D.6 No Dataset Exists

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
"I think video thumbnails with text overlays get more clicks"
```

**Expected Flow:**

- [ ] Recognizes no video/CTR datasets
- [ ] States gap clearly
- [ ] Suggests GitHub PR for dataset
- [ ] Offers to formulate for future

**Actual Tool Calls:**

```
[List tool calls]
```

**Claude Response:**

```
[Paste response]
```

**Quality Checks:**

- [ ] No hallucinated dataset
- [ ] Gap communicated clearly
- [ ] Actionable next steps

**Notes:**

```
[How well was data gap handled?]
```

---

## Phase E: Diverse Sampling Verification

### E.1 Hypothesis Sampling in Formulate-Hypothesis

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Use formulate-hypothesis prompt
```

**Expected:**

- [ ] API call: GET /api/hypotheses?sort=top_rated&limit=30
- [ ] Filters phase='completed' AND arenaElo > 1400
- [ ] Max 2 per domain
- [ ] Shows up to 8 total

**Actual Behavior:**

```
[Check API call parameters in MCP Inspector]
[List sampled hypotheses shown in context]
```

**Notes:**

```
[Domain diversity in samples]
```

---

### E.2 Empty Database Handling

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Use formulate-hypothesis prompt (with empty DB)
```

**Expected:**

- [ ] Shows "(No completed hypotheses available yet — be the first!)"
- [ ] Doesn't crash
- [ ] Rest of prompt loads

**Actual Behavior:**

```
[Paste relevant section]
```

**Notes:**

```
[Graceful degradation]
```

---

## Phase F: Edge Cases & Error Handling

### F.1 API Unreachable

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**Setup:** Stop dev server

**User Input:**

```
Call platform_overview
```

**Expected:**

- [ ] Clear error about API connectivity
- [ ] Doesn't crash session

**Actual Behavior:**

```
[Paste error message]
```

**Notes:**

```
[Error clarity]
```

---

### F.2 Invalid Hypothesis ID

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call get_hypothesis with hypothesisId="h-99999"
```

**Expected:**

- [ ] Error message about 404
- [ ] Doesn't crash

**Actual Behavior:**

```
[Paste error]
```

**Notes:**

```
[Error handling]
```

---

### F.3 Special Characters in Submission

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call generate_submission_url with:
- statement: 'Test "quotes" and (parens) & symbols'
```

**Expected:**

- [ ] URL generated
- [ ] Characters URL-encoded
- [ ] Form pre-fills correctly in browser

**Actual Behavior:**

```
[Paste URL]
[Test in browser - does form pre-fill?]
```

**Notes:**

```
[URL encoding correctness]
```

---

### F.4 Very Long Rationale

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call generate_submission_url with 2000+ character rationale
```

**Expected:**

- [ ] URL generates
- [ ] Note about length appears

**Actual Behavior:**

```
[Paste note message]
```

**Notes:**

```
[Handling of long content]
```

---

### F.5 Multiple Domains (Mixed)

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
Call generate_submission_url with:
- domains: ["memorability", "attention", "persuasion", "learning"]
```

**Expected:**

- [ ] Warning lists only "attention, learning"
- [ ] Excludes "memorability" and "persuasion"

**Actual Behavior:**

```
[Paste warning]
```

**Notes:**

```
[Correct filtering]
```

---

## Phase G: Tool Precision Testing

### G.1 Correct Tool Selection

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**Test Cases:**

1. "What datasets are available?"
   - [ ] Calls `list_datasets`

2. "Show me hypothesis h-5 in detail"
   - [ ] Calls `get_hypothesis`

3. "Find hypotheses about faces"
   - [ ] Calls `search_hypotheses`

4. "What's the current state of the platform?"
   - [ ] Calls `platform_overview`

**Notes:**

```
[Tool selection accuracy]
```

---

### G.2 Tool Call Efficiency

**Status:** [ ] Pass / [ ] Fail / [ ] Partial

**User Input:**

```
"I think warm colors make images more memorable"
```

**Expected:**

- [ ] ≤ 6 total tool calls
- [ ] No redundant calls

**Actual Tool Calls:**

```
1. [tool]
2. [tool]
...
Total: X
```

**Notes:**

```
[Efficiency assessment]
```

---

## Summary

### Overall Results

- **Total Test Cases:** 28
- **Passed:** [X]
- **Failed:** [X]
- **Partial:** [X]
- **Pass Rate:** [XX%]

### Critical Issues Found

1. [Issue description with test case ID]
2. [Issue description with test case ID]

### Recommendations

1. [Improvement suggestion]
2. [Improvement suggestion]

### Next Steps

- [ ] If pass rate ≥ 90%: Update MIGRATION_COMPATIBILITY.md
- [ ] If pass rate < 90%: Address failing tests, rebuild, re-test

---

**Testing completed on:** [Date]
**Time spent:** [Duration]
