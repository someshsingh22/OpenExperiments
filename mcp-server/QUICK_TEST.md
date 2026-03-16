# Quick Smoke Test (15 minutes)

This is a minimal test suite to verify the MCP server is working correctly after the domain flexibility and ExperiGen philosophy updates.

## Setup (5 min)

1. **Build:**

   ```bash
   cd /Users/someshsingh/Github/OpenExperiments/mcp-server
   npm run build
   ```

2. **Start Dev Server:**

   ```bash
   cd /Users/someshsingh/Github/OpenExperiments
   npm run dev
   ```

3. **Start MCP Inspector:**
   ```bash
   npx @modelcontextprotocol/inspector node /Users/someshsingh/Github/OpenExperiments/mcp-server/dist/index.js
   ```

## Critical Tests (10 min)

### Test 1: Platform Overview Shows ExperiGen Philosophy

**Query in MCP Inspector:**

```
platform_overview
```

**Quick Check:**

- ✅ Section appears: "## Philosophy: ExperiGen Feature Extractability"
- ✅ Shows extractable examples (brightness, sentiment, faces)
- ✅ Shows non-extractable examples (mood, intent)

**Status:** [ ] Pass / [ ] Fail

---

### Test 2: Domain Flexibility (Non-Standard Domain)

**Query:**

```json
{
  "name": "generate_submission_url",
  "arguments": {
    "statement": "Animated GIFs increase engagement",
    "rationale": "Motion captures attention",
    "domains": ["attention"],
    "customProblemStatement": "What captures viewer attention?"
  }
}
```

**Quick Check:**

- ✅ No schema validation error (domains accepts any string)
- ✅ URL generated successfully
- ✅ Warning appears about non-standard domain "attention"
- ✅ Warning mentions GitHub issue process

**Status:** [ ] Pass / [ ] Fail

---

### Test 3: Standard Domain (No Warning)

**Query:**

```json
{
  "name": "generate_submission_url",
  "arguments": {
    "statement": "Faces increase memorability",
    "rationale": "Faces are salient",
    "domains": ["memorability"],
    "problemStatementId": "ps-2"
  }
}
```

**Quick Check:**

- ✅ URL generated successfully
- ✅ **No warning section** appears

**Status:** [ ] Pass / [ ] Fail

---

### Test 4: Dataset Extractability Info

**Query:**

```json
{
  "name": "list_datasets",
  "arguments": {}
}
```

**Quick Check:**

- ✅ Each dataset has "Extractable Features" field
- ✅ ds-3 mentions: "brightness, color distribution; Face count, objects (VLM)"
- ✅ All 4 datasets have extractability info

**Status:** [ ] Pass / [ ] Fail

---

### Test 5: Formulate-Hypothesis Prompt Has ExperiGen Examples

**Query:**

```json
{
  "name": "formulate-hypothesis",
  "arguments": {}
}
```

**Quick Check:**

- ✅ Section: "What Makes a Good Hypothesis (ExperiGen Philosophy)"
- ✅ ✅ examples with extraction methods (warm colors → RGB, faces → VLM)
- ✅ ❌ examples (viewer's mood → not in dataset)
- ✅ Workflow step: "Identify extractable features"

**Status:** [ ] Pass / [ ] Fail

---

## Results

| Test                            | Status |
| ------------------------------- | ------ |
| 1. Platform Overview Philosophy | [ ]    |
| 2. Non-Standard Domain Warning  | [ ]    |
| 3. Standard Domain No Warning   | [ ]    |
| 4. Dataset Extractability       | [ ]    |
| 5. Formulate Prompt Examples    | [ ]    |

**Pass Rate:** X / 5 (\_\_%)

---

## If All Tests Pass ✅

The core functionality is working! Proceed to full test suite in `TESTING_GUIDE.md` for comprehensive validation.

## If Any Test Fails ❌

1. Check build output for errors: `npm run build`
2. Verify dist/index.js exists and is recent
3. Check API connectivity: `curl http://localhost:3000/api/hypotheses`
4. Review error messages in MCP Inspector
5. Check that OPENEXPERIMENTS_API_URL env var is set

---

## Testing with Claude Desktop/Code

If using Claude Desktop or Claude Code instead of MCP Inspector:

**Test 1:**

```
Call the platform_overview tool and show me the philosophy section
```

**Test 2:**

```
Generate a submission URL with these details:
- Statement: "Animated GIFs increase engagement"
- Rationale: "Motion captures attention"
- Domains: ["attention"]
- Custom problem statement: "What captures viewer attention?"
```

**Test 3:**

```
Generate a submission URL with:
- Statement: "Faces increase memorability"
- Domains: ["memorability"]
- Problem statement ID: "ps-2"
```

**Test 4:**

```
List all datasets and show me the extractable features for each
```

**Test 5:**

```
Use the formulate-hypothesis prompt and show me the criteria section
```

---

**Quick test complete!** If all 5 tests pass, the MCP server is ready for production use.
