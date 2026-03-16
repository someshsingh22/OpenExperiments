#!/usr/bin/env node

import { config } from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Load .env file if present
config();

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const API_URL = process.env.OPENEXPERIMENTS_API_URL || "https://openexperiments.pages.dev";
const SITE_URL = process.env.OPENEXPERIMENTS_SITE_URL || API_URL;

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

async function api<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`);
  } catch (err) {
    throw new Error(
      `Cannot reach OpenExperiments API at ${API_URL}. Is the server running?\n${
        err instanceof Error ? err.message : err
      }`,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`API ${res.status} on ${path}: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "openexperiments",
  version: "1.0.0",
});

// ===================================================================
// TOOLS
// ===================================================================

// --- Problem Statements ------------------------------------------------

server.tool(
  "list_problem_statements",
  "List all open research questions on OpenExperiments with linked datasets. " +
    "Call this first when helping formulate a hypothesis — it shows what " +
    "research areas are active and what data is available for testing.",
  {},
  async () => {
    const { data } = await api<{ data: any[] }>("/api/problem-statements?includeDatasets=true");
    let text = `# Problem Statements (${data.length})\n\n`;
    for (const ps of data) {
      text += `## ${ps.question}\n`;
      text += `- ID: ${ps.id}\n`;
      text += `- Domain: ${ps.domain}\n`;
      text += `- Hypotheses: ${ps.hypothesisCount}\n`;
      text += `- Description: ${ps.description}\n`;
      if (ps.datasets?.length > 0) {
        text += `- Datasets: ${ps.datasets.map((d: any) => `${d.name} (${d.id})`).join(", ")}\n`;
      } else {
        text += `- Datasets: None — new datasets needed\n`;
      }
      text += `\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
);

// --- Datasets ----------------------------------------------------------

server.tool(
  "list_datasets",
  "List all Hugging Face datasets with column schemas and extractable features. " +
    "For each dataset, see what features can be DERIVED: brightness from image pixels, " +
    "sentiment from text, object counts from images via VLMs, etc. Filter by domain if needed.",
  {
    domain: z
      .string()
      .optional()
      .describe("Filter by domain (any string, e.g., 'attention', 'learning')"),
  },
  async ({ domain }) => {
    const qs = domain ? `?domain=${domain}` : "";
    const { data } = await api<{ data: any[] }>(`/api/datasets${qs}`);
    let text = `# Datasets (${data.length})\n\n`;
    for (const d of data) {
      text += `## ${d.name} (${d.id})\n`;
      text += `- Domain: ${d.domain || "unspecified"}\n`;
      text += `- HuggingFace: ${d.huggingfaceUrl}\n`;
      text += `- Task: ${d.taskDescription}\n`;
      const cols = Array.isArray(d.dataColumnNames)
        ? d.dataColumnNames.join(", ")
        : d.dataColumnNames;
      text += `- Columns: ${cols}\n`;
      text += `- Target: ${d.targetColumnName}\n`;
      if (d.description) text += `- Description: ${d.description}\n`;
      text += `- Problem statements: ${d.problemStatementCount ?? 0} | Experiments: ${d.experimentCount ?? 0}\n`;

      // Add extractability information
      text += `- **Extractable Features**: `;
      const extractabilityMap: Record<string, string> = {
        "ds-1":
          "Text sentiment, length, readability, named entities (NLP); User karma, post history (if not anonymized); Temporal patterns (from timestamp)",
        "ds-2":
          "Image brightness, contrast, color distribution, dominant colors (pixel analysis); Face count, object types, scene category (VLM); Composition features (rule of thirds, focal points)",
        "ds-3": "Tweet sentiment, hashtags, mentions, length; Engagement metrics (retweets, likes)",
        "ds-4": "Same as LaMem + attention map gaze patterns, fixation duration",
      };
      text +=
        extractabilityMap[d.id] ||
        "Code-based from structured data; LLM/NLP-based from text; VLM-based from images";
      text += `\n\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
);

server.tool(
  "get_dataset",
  "Get full details of a specific dataset: schema, linked problem statements, " +
    "and experiments. CRITICAL: Focus on what features can be EXTRACTED from the " +
    "available columns (e.g., brightness from pixels, sentiment from text, face count via VLMs).",
  {
    datasetId: z.string().describe("Dataset ID (e.g., 'ds-1')"),
  },
  async ({ datasetId }) => {
    const res = await api<{
      data: any;
      problemStatements: any[];
      experiments: any[];
    }>(`/api/datasets/${datasetId}`);
    const d = res.data;
    let text = `# ${d.name}\n\n`;
    text += `- HuggingFace: ${d.huggingfaceUrl}\n`;
    text += `- Domain: ${d.domain || "unspecified"}\n`;
    text += `- Task: ${d.taskDescription}\n`;
    const cols = Array.isArray(d.dataColumnNames)
      ? d.dataColumnNames.join(", ")
      : d.dataColumnNames;
    text += `- Columns: ${cols}\n`;
    text += `- Target: ${d.targetColumnName}\n`;
    if (d.description) text += `- Description: ${d.description}\n`;

    // Add extractability information
    text += `\n**Extractable Features**:\n`;
    const extractabilityMap: Record<string, string> = {
      "ds-1":
        "• Text: sentiment, length, readability, named entities (via NLP)\n• User: karma, post history (if not anonymized)\n• Temporal: time since post, posting patterns (from timestamp)\n• ❌ Cannot extract: author intent, viewer mood",
      "ds-2":
        "• Image: brightness, contrast, color distribution, dominant colors\n• Objects: face count, object types, scene category (via VLM)\n• Composition: focal points, rule of thirds alignment\n• ❌ Cannot extract: emotional impact on viewer, cultural significance",
      "ds-3":
        "• Tweet: sentiment, hashtags, mentions, length\n• Engagement: retweet counts, like counts\n• ❌ Cannot extract: sarcasm (unreliable), user demographics (if anonymized)",
      "ds-4":
        "• Image: same as LaMem\n• Attention: gaze patterns, fixation duration\n• ❌ Cannot extract: viewer prior knowledge, personal associations",
    };
    text +=
      extractabilityMap[datasetId] ||
      "• Code-based: statistical aggregations from structured data\n• LLM-based: semantic features from text fields\n• VLM-based: visual features from image fields\n";

    text += `\n## Problem Statements (${res.problemStatements.length})\n\n`;
    for (const ps of res.problemStatements) {
      text += `- ${ps.question} (${ps.id}, ${ps.domain}, ${ps.hypothesisCount} hypotheses)\n`;
    }

    text += `\n## Experiments (${res.experiments.length})\n\n`;
    for (const exp of res.experiments) {
      text += `- ${exp.id}: ${exp.type} (${exp.status}) — hypothesis ${exp.hypothesisId}\n`;
      text += `  ${exp.methodology.slice(0, 150)}...\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
);

// --- Hypotheses --------------------------------------------------------

server.tool(
  "search_hypotheses",
  "Search hypotheses by keyword across statements, rationales, and problem " +
    "statements. Use to find related work across ALL domains, check for duplicates, " +
    "or get inspiration. Supports filtering by domain, phase, and status.",
  {
    query: z.string().describe("Search keywords"),
    domain: z.string().optional().describe("Filter by domain (any string)"),
    phase: z.enum(["live", "completed"]).optional().describe("Filter by phase"),
    status: z
      .enum(["proposed", "arena_ranked", "data_tested", "field_validated"])
      .optional()
      .describe("Filter by evidence status"),
    limit: z.number().optional().describe("Max results (default 20)"),
  },
  async ({ query, domain, phase, status, limit }) => {
    const params = new URLSearchParams({
      search: query,
      limit: String(limit || 20),
    });
    if (domain) params.set("domain", domain);
    if (phase) params.set("phase", phase);
    if (status) params.set("status", status);

    const { data, total } = await api<{ data: any[]; total: number }>(`/api/hypotheses?${params}`);

    let text = `# Search: "${query}" — ${data.length} of ${total} results\n\n`;
    for (const h of data) {
      text += `### ${h.id}: ${h.statement}\n`;
      text += `- Status: ${h.status} | Phase: ${h.phase} | Source: ${h.source}${h.agentName ? ` (${h.agentName})` : ""}\n`;
      const domains = Array.isArray(h.domain) ? h.domain.join(", ") : h.domain;
      text += `- Domain: ${domains} | Problem: ${h.problemStatement}\n`;
      if (h.arenaElo) text += `- ELO: ${h.arenaElo}`;
      if (h.pValue != null) text += ` | p=${h.pValue}, d=${h.effectSize}`;
      if (h.arenaElo || h.pValue != null) text += `\n`;
      text += `- Comments: ${h.commentCount}\n\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
);

server.tool(
  "get_hypothesis",
  "Get full details of a hypothesis: statement, rationale, all experiments " +
    "with results, comments, and citations.",
  {
    hypothesisId: z.string().describe("Hypothesis ID (e.g., 'h-1')"),
  },
  async ({ hypothesisId }) => {
    const res = await api<{
      data: any;
      experiments: any[];
      comments: any[];
    }>(`/api/hypotheses/${hypothesisId}`);

    const h = res.data;
    let text = `# Hypothesis ${h.id}\n\n`;
    text += `**Statement:** ${h.statement}\n\n`;
    text += `**Rationale:** ${h.rationale}\n\n`;
    text += `- Status: ${h.status} | Phase: ${h.phase}\n`;
    text += `- Source: ${h.source}${h.agentName ? ` (${h.agentName})` : ""}\n`;
    const domains = Array.isArray(h.domain) ? h.domain.join(", ") : h.domain;
    text += `- Domain: ${domains}\n`;
    text += `- Problem: ${h.problemStatement}\n`;
    text += `- Submitted: ${h.submittedAt}\n`;
    if (h.arenaElo) text += `- ELO: ${h.arenaElo}\n`;
    if (h.evidenceScore) text += `- Evidence Score: ${h.evidenceScore}\n`;
    if (h.pValue != null) text += `- p=${h.pValue}, d=${h.effectSize}\n`;
    if (h.citationDois?.length > 0) text += `- Citations: ${h.citationDois.join(", ")}\n`;
    if (h.relatedHypothesisIds?.length > 0)
      text += `- Related: ${h.relatedHypothesisIds.join(", ")}\n`;

    text += `\n## Experiments (${res.experiments.length})\n\n`;
    for (const exp of res.experiments) {
      text += `### ${exp.id} — ${exp.type} (${exp.status})\n`;
      text += `- Dataset: ${exp.datasetName}\n`;
      text += `- Methodology: ${exp.methodology}\n`;
      if (exp.results) {
        text += `- **Results:** p=${exp.results.pValue}, d=${exp.results.effectSize}, n=${exp.results.sampleSize}\n`;
        text += `  CI: [${exp.results.confidenceInterval[0]}, ${exp.results.confidenceInterval[1]}]\n`;
        text += `  ${exp.results.summary}\n`;
        if (exp.results.uplift) text += `  Uplift: ${exp.results.uplift}\n`;
      }
      text += `\n`;
    }

    text += `## Comments (${res.comments.length})\n\n`;
    for (const c of res.comments) {
      text += `- ${c.body}${c.doi ? ` [DOI: ${c.doi}]` : ""}\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
);

// --- Arena -------------------------------------------------------------

server.tool(
  "get_arena_rankings",
  "Get the arena leaderboard: top hypotheses ranked by community vote win " +
    "rate. Only includes completed (validated) hypotheses.",
  {},
  async () => {
    const { data } = await api<{ data: any[] }>("/api/arena/rankings");
    let text = `# Arena Rankings — Top ${data.length}\n\n`;
    text += `| # | ID | Win% | Domain | Hypothesis |\n`;
    text += `|---|-----|------|--------|------------|\n`;
    data.forEach((h: any, i: number) => {
      const d = Array.isArray(h.domain) ? h.domain.join(", ") : h.domain;
      text += `| ${i + 1} | ${h.id} | ${h.winRate}% | ${d} | ${h.statement.slice(0, 80)}... |\n`;
    });
    return { content: [{ type: "text" as const, text }] };
  },
);

// --- Experiments -------------------------------------------------------

server.tool(
  "list_experiments",
  "List experiments with methodology, dataset, status, and results. " +
    "Optionally filter by hypothesis ID.",
  {
    hypothesisId: z.string().optional().describe("Filter by hypothesis ID"),
  },
  async ({ hypothesisId }) => {
    const qs = hypothesisId ? `?hypothesisId=${hypothesisId}` : "";
    const { data } = await api<{ data: any[] }>(`/api/experiments${qs}`);
    let text = `# Experiments (${data.length})\n\n`;
    for (const e of data) {
      text += `## ${e.id} — ${e.type} (${e.status})\n`;
      text += `- Hypothesis: ${e.hypothesisId}\n`;
      text += `- Dataset: ${e.datasetName}\n`;
      text += `- Period: ${e.startedAt}${e.completedAt ? ` to ${e.completedAt}` : " (ongoing)"}\n`;
      text += `- Methodology: ${e.methodology}\n`;
      if (e.results) {
        text += `- **p=${e.results.pValue}**, d=${e.results.effectSize}, n=${e.results.sampleSize}\n`;
        text += `  CI: [${e.results.confidenceInterval[0]}, ${e.results.confidenceInterval[1]}]\n`;
        text += `  ${e.results.summary}\n`;
      }
      text += `\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
);

server.tool(
  "get_experiment",
  "Get full details of a specific experiment: methodology, statistical " +
    "results, and the hypothesis it tests.",
  {
    experimentId: z.string().describe("Experiment ID (e.g., 'exp-1')"),
  },
  async ({ experimentId }) => {
    const res = await api<{ data: any; hypothesis: any }>(`/api/experiments/${experimentId}`);
    const e = res.data;
    let text = `# Experiment ${e.id}\n\n`;
    text += `- Type: ${e.type} | Status: ${e.status}\n`;
    text += `- Dataset: ${e.datasetName}\n`;
    text += `- Period: ${e.startedAt}${e.completedAt ? ` to ${e.completedAt}` : ""}\n\n`;
    text += `**Methodology:**\n${e.methodology}\n`;

    if (e.results) {
      text += `\n**Results:**\n`;
      text += `- p-value: ${e.results.pValue}\n`;
      text += `- Effect size: ${e.results.effectSize}\n`;
      text += `- 95% CI: [${e.results.confidenceInterval[0]}, ${e.results.confidenceInterval[1]}]\n`;
      text += `- Sample size: ${e.results.sampleSize}\n`;
      text += `- Summary: ${e.results.summary}\n`;
      if (e.results.uplift) text += `- Uplift: ${e.results.uplift}\n`;
    }

    if (res.hypothesis) {
      text += `\n**Linked Hypothesis (${res.hypothesis.id}):**\n`;
      text += `${res.hypothesis.statement}\n`;
      text += `Status: ${res.hypothesis.status}, Phase: ${res.hypothesis.phase}\n`;
    }
    return { content: [{ type: "text" as const, text }] };
  },
);

// --- Platform overview -------------------------------------------------

server.tool(
  "platform_overview",
  "High-level overview of the OpenExperiments platform: current stats, " +
    "domains, hypothesis lifecycle, and how the workflow works. Call this " +
    "first to orient yourself before using other tools.",
  {},
  async () => {
    const [hypRes, psRes, dsRes, expRes, arenaRes] = await Promise.all([
      api<{ data: any[]; total: number }>("/api/hypotheses?limit=100"),
      api<{ data: any[] }>("/api/problem-statements?includeDatasets=true"),
      api<{ data: any[] }>("/api/datasets"),
      api<{ data: any[] }>("/api/experiments"),
      api<{ data: any[] }>("/api/arena/rankings"),
    ]);

    const hyps = hypRes.data;
    const byStatus = {
      proposed: hyps.filter((h) => h.status === "proposed").length,
      arena_ranked: hyps.filter((h) => h.status === "arena_ranked").length,
      data_tested: hyps.filter((h) => h.status === "data_tested").length,
      field_validated: hyps.filter((h) => h.status === "field_validated").length,
    };
    const byPhase = {
      live: hyps.filter((h) => h.phase === "live").length,
      completed: hyps.filter((h) => h.phase === "completed").length,
    };

    let text = `# OpenExperiments Platform Overview\n\n`;
    text += `An open platform where anyone — humans and AI — can submit a scientific hypothesis, have the community evaluate it, and see it tested against real-world data.\n\n`;
    text += `Website: ${SITE_URL}\n\n`;

    text += `## Stats\n\n`;
    text += `| Metric | Count |\n|--------|-------|\n`;
    text += `| Hypotheses | ${hypRes.total} |\n`;
    text += `| Problem Statements | ${psRes.data.length} |\n`;
    text += `| Datasets | ${dsRes.data.length} |\n`;
    text += `| Experiments | ${expRes.data.length} |\n`;
    text += `| Arena Ranked | ${arenaRes.data.length} |\n`;

    text += `\n## By Status\n`;
    text += `- Proposed: ${byStatus.proposed}\n`;
    text += `- Arena Ranked: ${byStatus.arena_ranked}\n`;
    text += `- Data Tested: ${byStatus.data_tested}\n`;
    text += `- Field Validated: ${byStatus.field_validated}\n`;

    text += `\n## By Phase\n`;
    text += `- Live (accepting votes): ${byPhase.live}\n`;
    text += `- Completed (results available): ${byPhase.completed}\n`;

    text += `\n## Philosophy: ExperiGen Feature Extractability\n\n`;
    text += `**Core Principle**: Hypotheses must test features COMPUTABLE from available data.\n\n`;
    text += `**✅ EXTRACTABLE (Testable)**:\n`;
    text += `- Brightness, contrast, color → extracted from image pixel values\n`;
    text += `- Sentiment, readability, length → extracted from text via NLP\n`;
    text += `- Face count, object types → extracted from images via VLMs\n`;
    text += `- Duration, frequency → calculated from timestamps\n`;
    text += `- Correlation patterns → statistical analysis of numerical data\n\n`;
    text += `**❌ NOT EXTRACTABLE (Need new data)**:\n`;
    text += `- Viewer's mood, emotions → not stored in any field\n`;
    text += `- Author's true intent → not measurable from text alone\n`;
    text += `- Cultural significance → requires external knowledge\n`;
    text += `- Temporal trends → requires timestamps (if missing)\n`;
    text += `- User demographics → requires user data (if anonymized)\n\n`;
    text += `**Domains**: Start with persuasion or memorability, or PROPOSE NEW domains!\n`;
    text += `(attention, learning, decision-making, memory, perception, etc.)\n`;

    text += `\n## Hypothesis Lifecycle\n`;
    text += `proposed -> arena_ranked -> data_tested -> field_validated\n`;
    text += `Each hypothesis has a phase: live (accepting input) or completed (results in)\n`;

    text += `\n## Workflow\n`;
    text += `1. Ideate: Submit a testable hypothesis for a problem statement\n`;
    text += `2. Evaluate: Community votes in head-to-head arena comparisons\n`;
    text += `3. Test: AI agents test hypotheses against real-world datasets\n`;
    text += `4. Validate: Top hypotheses advance to pre-registered field experiments\n`;

    return { content: [{ type: "text" as const, text }] };
  },
);

// --- Submission URL generator ------------------------------------------

server.tool(
  "generate_submission_url",
  "Generate a pre-filled URL to the OpenExperiments submit page. Use this " +
    "after helping a user formulate a hypothesis — they click the link, " +
    "review the pre-filled form, and submit.",
  {
    statement: z.string().describe("The hypothesis statement"),
    rationale: z.string().describe("The rationale behind the hypothesis"),
    problemStatementId: z
      .string()
      .optional()
      .describe("Existing problem statement ID (e.g., 'ps-1')"),
    customProblemStatement: z
      .string()
      .optional()
      .describe("Custom problem statement if not using an existing one"),
    domains: z
      .array(z.string())
      .describe("Research domains (any strings, e.g., ['attention'], ['memory', 'learning'])"),
    source: z
      .enum(["human", "ai_agent"])
      .optional()
      .describe("Who generated the hypothesis (default: human)"),
  },
  async ({ statement, rationale, problemStatementId, customProblemStatement, domains, source }) => {
    const params = new URLSearchParams();
    params.set("statement", statement);
    params.set("rationale", rationale);
    params.set("domains", domains.join(","));
    if (problemStatementId) params.set("ps", problemStatementId);
    if (customProblemStatement) params.set("customPS", customProblemStatement);
    if (source) params.set("source", source);

    const url = `${SITE_URL}/submit?${params.toString()}`;

    let text = `## Ready to Submit\n\n`;
    text += `Pre-filled submission link:\n\n`;
    text += `${url}\n\n`;
    text += `### Summary\n`;
    text += `- Statement: ${statement}\n`;
    text += `- Rationale: ${rationale.slice(0, 200)}${rationale.length > 200 ? "..." : ""}\n`;
    text += `- Problem: ${problemStatementId || customProblemStatement || "not specified"}\n`;
    text += `- Domains: ${domains.join(", ")}\n`;
    text += `- Source: ${source || "human"}\n\n`;
    text += `Click the link to review and submit on OpenExperiments.\n`;

    if (rationale.length > 1500) {
      text += `\nNote: The rationale is long (${rationale.length} chars). If the link `;
      text += `doesn't load fully, the form will be partially pre-filled — `;
      text += `paste the rationale manually.\n`;
    }

    // Add warning if using non-standard domains
    const standardDomains = ["persuasion", "memorability"];
    const nonStandardDomains = domains.filter((d) => !standardDomains.includes(d.toLowerCase()));

    if (nonStandardDomains.length > 0) {
      text += `\n---\n\n`;
      text += `⚠️  **Domain Submission Note**\n\n`;
      text += `Your hypothesis uses: **${nonStandardDomains.join(", ")}**\n\n`;
      text += `The platform currently accepts hypotheses in these domains through `;
      text += `the web UI, but the domain field will be restricted to standard options. `;
      text += `Your hypothesis will be associated with an existing domain that's closest.\n\n`;
      text += `To propose "${nonStandardDomains[0]}" as a new official domain:\n`;
      text += `1. Open an issue at ${SITE_URL}/issues (GitHub link in footer)\n`;
      text += `2. Describe the domain and why it's valuable\n`;
      text += `3. Optionally: suggest datasets for this domain\n`;
      text += `4. Community + maintainers will review\n\n`;
      text += `Your hypothesis can still be submitted! The problem statement you `;
      text += `propose will be recorded with your custom text.\n`;
    }

    return { content: [{ type: "text" as const, text }] };
  },
);

// ===================================================================
// PROMPTS
// ===================================================================

server.prompt(
  "formulate-hypothesis",
  "Load all OpenExperiments context (problem statements, datasets, example " +
    "hypotheses) to help turn a rough idea into a testable hypothesis.",
  {
    idea: z.string().optional().describe("The user's rough idea or area of interest"),
  },
  async ({ idea }) => {
    const [psRes, dsRes, hypRes] = await Promise.all([
      api<{ data: any[] }>("/api/problem-statements?includeDatasets=true"),
      api<{ data: any[] }>("/api/datasets"),
      api<{ data: any[] }>("/api/hypotheses?sort=top_rated&limit=30"),
    ]);

    let ctx = "";
    ctx += `You are helping a user formulate a testable scientific hypothesis `;
    ctx += `for OpenExperiments, a platform where hypotheses are submitted, `;
    ctx += `community-ranked in blind arenas, and tested against real-world `;
    ctx += `data by AI agents.\n\n`;

    ctx += `## What Makes a Good Hypothesis (ExperiGen Philosophy)\n\n`;
    ctx += `**1. Feature Extractability** — Tests a feature COMPUTABLE from data:\n`;
    ctx += `   ✅ "Warm colors increase image memorability"\n`;
    ctx += `      → Color extractable from RGB pixel values (code-based)\n`;
    ctx += `   ✅ "Longer arguments are more persuasive"\n`;
    ctx += `      → Length extractable from text character count (code-based)\n`;
    ctx += `   ✅ "Images with faces are more memorable"\n`;
    ctx += `      → Face presence extractable via VLM (computer vision)\n`;
    ctx += `   ✅ "Positive sentiment increases persuasiveness"\n`;
    ctx += `      → Sentiment extractable from text via NLP/LLM\n`;
    ctx += `   ❌ "Viewer's mood affects memory"\n`;
    ctx += `      → Mood NOT in dataset (would need surveys)\n`;
    ctx += `   ❌ "Arguments posted at night are less persuasive"\n`;
    ctx += `      → Temporal feature needs timestamp field (check if exists!)\n\n`;
    ctx += `**2. Specificity & Falsifiability** — Clear claim with expected direction\n\n`;
    ctx += `**3. Grounded Rationale** — Based on theory, prior work, or observation\n\n`;
    ctx += `**4. Novelty** — Distinct from existing hypotheses\n\n`;
    ctx += `**5. Any Domain** — Persuasion, memorability, OR propose new domains:\n`;
    ctx += `   attention, learning, memory, decision-making, perception, etc.\n`;
    ctx += `   Problem statements can be proposed even without datasets initially.\n\n`;

    ctx += `## Active Problem Statements\n\n`;
    for (const ps of psRes.data) {
      ctx += `### ${ps.question} (${ps.id})\n`;
      ctx += `Domain: ${ps.domain} | ${ps.hypothesisCount} hypotheses submitted\n`;
      ctx += `${ps.description}\n`;
      if (ps.datasets?.length > 0) {
        ctx += `Datasets: ${ps.datasets.map((d: any) => d.name).join(", ")}\n`;
      } else {
        ctx += `Datasets: NONE — this area needs datasets before hypotheses can be tested\n`;
      }
      ctx += `\n`;
    }

    ctx += `## Available Datasets (What Can Be Extracted?)\n\n`;
    ctx += `For each dataset, consider what features can be DERIVED using:\n`;
    ctx += `- **Code**: brightness from pixels, length from text, counts, ratios\n`;
    ctx += `- **NLP/LLM**: sentiment, readability, named entities, topics from text\n`;
    ctx += `- **VLM**: object detection, face count, scene category from images\n`;
    ctx += `- **Statistical**: correlations, aggregations from numerical data\n\n`;
    ctx += `**Key Question**: "Can I compute this feature from the available columns?"\n\n`;

    for (const d of dsRes.data) {
      ctx += `### ${d.name} (${d.id})\n`;
      ctx += `Domain: ${d.domain || "unspecified"}\n`;
      ctx += `Task: ${d.taskDescription}\n`;
      const cols = Array.isArray(d.dataColumnNames)
        ? d.dataColumnNames.join(", ")
        : d.dataColumnNames;
      ctx += `Columns: ${cols}\n`;
      ctx += `Target: ${d.targetColumnName}\n`;
      if (d.description) ctx += `${d.description}\n`;

      // Add extractability info
      const extractabilityMap: Record<string, string> = {
        "ds-1": "Text sentiment, length, readability; User karma; Temporal patterns",
        "ds-2": "Brightness, color distribution; Face count, objects (VLM); Composition",
        "ds-3": "Tweet sentiment, hashtags, length; Engagement metrics",
        "ds-4": "Same as LaMem + attention gaze patterns",
      };
      ctx += `**→ Extractable**: ${extractabilityMap[d.id] || "Check columns for possibilities"}\n`;
      ctx += `\n`;
    }

    // Sample diverse hypotheses across domains (max 2 per domain, ELO > 1400)
    const domainCounts = new Map<string, number>();
    const sampled = hypRes.data
      .filter((h: any) => h.phase === "completed" && (h.arenaElo || 0) > 1400)
      .filter((h: any) => {
        const d = Array.isArray(h.domain) ? h.domain[0] : h.domain;
        const count = domainCounts.get(d) || 0;
        if (count < 2) {
          domainCounts.set(d, count + 1);
          return true;
        }
        return false;
      })
      .slice(0, 8);

    ctx += `## Example Hypotheses (top-rated, diverse domains)\n\n`;
    if (sampled.length === 0) {
      ctx += `(No completed hypotheses available yet — be the first!)\n\n`;
    } else {
      for (const h of sampled) {
        ctx += `**${h.statement}**\n`;
        ctx += `Rationale: ${h.rationale}\n`;
        const domains = Array.isArray(h.domain) ? h.domain.join(", ") : h.domain;
        ctx += `Domain: ${domains} | Problem: ${h.problemStatement}\n`;
        ctx += `Status: ${h.status}`;
        if (h.arenaElo) ctx += ` | ELO: ${h.arenaElo}`;
        if (h.pValue != null) ctx += ` | p=${h.pValue}, d=${h.effectSize}`;
        ctx += `\n\n`;
      }
    }

    ctx += `## Your Workflow\n\n`;
    ctx += `1. **Understand the domain** — ANY domain, not just persuasion/memorability\n`;
    ctx += `2. **Identify extractable features** from available datasets:\n`;
    ctx += `   - What columns exist? (text, image_path, timestamp, etc.)\n`;
    ctx += `   - What can be EXTRACTED? (sentiment, brightness, duration, etc.)\n`;
    ctx += `   - What CANNOT be extracted? (mood, intent, external info)\n`;
    ctx += `3. **Check for duplicates** with search_hypotheses tool across ALL domains\n`;
    ctx += `4. **Match or propose problem statement**:\n`;
    ctx += `   - Existing: pick from list\n`;
    ctx += `   - New: propose it! (will have no dataset initially, can be added later)\n`;
    ctx += `5. **Explain extraction method** — EXACTLY how the feature would be extracted:\n`;
    ctx += `   "We'd extract brightness using code to read pixel RGB values"\n`;
    ctx += `   "We'd extract sentiment using an LLM prompt on the text field"\n`;
    ctx += `   "We'd count faces using a VLM on the image_path field"\n`;
    ctx += `6. **If NO dataset exists**: State clearly, suggest user finds one on Hugging Face\n`;
    ctx += `   and proposes it via GitHub PR (see /contribute page)\n`;
    ctx += `7. **Generate submission URL** with generate_submission_url tool\n`;

    if (idea) {
      ctx += `\n## User's Idea\n\n`;
      ctx += `The user is interested in: "${idea}"\n\n`;
      ctx += `Help them develop this into a testable hypothesis for the platform.\n`;
    } else {
      ctx += `\n## Getting Started\n\n`;
      ctx += `Ask the user what domain interests them (persuasion, memory, attention, `;
      ctx += `learning, decision-making, etc.) and what they think might be true. `;
      ctx += `ALL scientific domains welcome! If they have a vague idea, help them `;
      ctx += `identify which features can be EXTRACTED from available data.\n`;
    }

    return {
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: ctx },
        },
      ],
    };
  },
);

server.prompt(
  "co-ideate",
  "Brainstorm new hypothesis ideas. Loads existing hypotheses, results, " +
    "and gaps to inspire new research directions.",
  {
    domain: z.string().optional().describe("Focus on a specific domain (any string)"),
  },
  async ({ domain }) => {
    const params = new URLSearchParams({ sort: "top_rated", limit: "20" });
    if (domain) params.set("domain", domain);

    const [hypRes, psRes] = await Promise.all([
      api<{ data: any[] }>(`/api/hypotheses?${params}`),
      api<{ data: any[] }>("/api/problem-statements?includeDatasets=true"),
    ]);

    let ctx = `You are co-ideating new research hypotheses with a user on OpenExperiments. `;
    ctx += `Explore ANY domain—not just persuasion/memorability. Focus on features `;
    ctx += `that can be EXTRACTED from available datasets:\n`;
    ctx += `- Code-based: brightness, length, counts\n`;
    ctx += `- LLM-based: sentiment, topics, named entities\n`;
    ctx += `- VLM-based: faces, objects, scenes\n\n`;

    ctx += `## Existing Hypotheses\n\n`;
    for (const h of hypRes.data) {
      const domains = Array.isArray(h.domain) ? h.domain.join(", ") : h.domain;
      ctx += `- **${h.statement}**\n`;
      ctx += `  ${h.status} | ${h.source}${h.agentName ? ` / ${h.agentName}` : ""} | ${domains}\n`;
      ctx += `  Problem: ${h.problemStatement}\n`;
      if (h.pValue != null) ctx += `  Result: p=${h.pValue}, d=${h.effectSize}\n`;
      ctx += `\n`;
    }

    ctx += `## Open Questions\n\n`;
    for (const ps of psRes.data) {
      ctx += `- **${ps.question}** (${ps.domain}, ${ps.hypothesisCount} hypotheses)`;
      if (ps.datasets?.length > 0) {
        ctx += ` — Datasets: ${ps.datasets.map((d: any) => d.name).join(", ")}`;
      }
      ctx += `\n`;
    }

    ctx += `\n## How to Brainstorm\n\n`;
    ctx += `1. **Identify gaps** — What features haven't been tested?\n`;
    ctx += `   Consider: texture, motion, temporal patterns, cross-modal effects\n`;
    ctx += `2. **Find contradictions** — Which results conflict? Why?\n`;
    ctx += `3. **Suggest extensions** — Combine existing ideas or test new domains\n`;
    ctx += `4. **Check extractability** — Can the feature be computed from existing data?\n`;
    ctx += `5. **Propose new domains** — Beyond persuasion/memorability:\n`;
    ctx += `   attention, learning, memory consolidation, decision-making, perception\n`;
    ctx += `6. When the user likes an idea, use generate_submission_url\n\n`;

    if (domain) ctx += `Focus area: **${domain}** (but feel free to explore adjacent domains)\n`;

    ctx += `\nStart by summarizing what's been explored, identify extractability `;
    ctx += `constraints, and suggest 2-3 testable directions.\n`;

    return {
      messages: [
        {
          role: "user" as const,
          content: { type: "text" as const, text: ctx },
        },
      ],
    };
  },
);

// ===================================================================
// RESOURCES
// ===================================================================

server.resource("platform-guide", "openexperiments://guide", async (uri) => ({
  contents: [
    {
      uri: uri.href,
      mimeType: "text/markdown",
      text: `# OpenExperiments Platform Guide

## What Is It?

An open platform where anyone — humans and AI — can submit a scientific
hypothesis, have the community vote on it, and see AI agents test it
against real-world data. Democratising science, one hypothesis at a time.

## ExperiGen Philosophy: Feature Extractability

**Core principle**: Hypotheses test features COMPUTABLE from existing data.

**✅ EXTRACTABLE (You can test this)**:
- Brightness, color, contrast → from image pixel RGB values
- Sentiment, tone, complexity → from text using NLP/LLMs
- Face count, object types, scene category → from images using VLMs
- Duration, frequency, patterns → from timestamps/structured data
- Post history, engagement → from user metadata (if not anonymized)

**❌ NOT EXTRACTABLE (Need new data collection)**:
- Viewer's mood or emotions → not stored in any field
- Author's true underlying intent → can't measure from text alone
- Cultural significance → requires external cultural knowledge
- Temporal patterns → need timestamp field (check if available!)
- User demographics → need user data (check if anonymized!)

**Think**: "Can I compute this using the available columns + AI/code?"

## Domains

- **Persuasion**: What makes arguments persuasive (Reddit CMV, Twitter)
- **Memorability**: What makes images memorable (LaMem, Visual Attention)
- **[Propose New]**: Attention, learning, memory, decision-making, perception...

Any scientific domain is welcome! Problem statements can be proposed even
without initial datasets—find or suggest datasets later via GitHub PR.

## Hypothesis Lifecycle

1. **Proposed** — submitted, not yet evaluated
2. **Arena Ranked** — community has voted in pairwise comparisons
3. **Data Tested** — AI agents ran experiments against datasets
4. **Field Validated** — confirmed via pre-registered field experiments

Phase: **live** (accepting input) or **completed** (results published)

## Submitting a Hypothesis

A good hypothesis:
- Makes a specific, falsifiable claim
- Can be tested with available datasets
- Has a clear expected direction of effect
- Includes a rationale (why you believe this)
- Cites prior work when possible (DOIs)

## Datasets

Curated Hugging Face datasets. Each has:
- Column schema (available features)
- Target column (what we predict)
- Task description (what hypotheses it can test)
- Linked problem statements

## Arena

Blind pairwise comparisons. Source and scores are hidden.
Vote options: A is better, B is better, Tie, Both weak.
Produces ELO-based rankings.

## Contributing

- Submit hypotheses at /submit
- Vote in arena at /arena
- Suggest datasets via GitHub PR
- Conduct experiments
- Help develop the platform

Contact: experimentsopen@gmail.com
Paper: https://arxiv.org/abs/2602.07983`,
    },
  ],
}));

// ===================================================================
// START
// ===================================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
