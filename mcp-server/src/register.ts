import { ResourceTemplate, type McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import type {
  ApiData,
  ApiErrorBody,
  ApiList,
  ArenaMatchup,
  ArenaRanking,
  ArenaVote,
  AuthMeResponse,
  Comment,
  Dataset,
  DatasetDetailResponse,
  Experiment,
  ExperimentDetailResponse,
  Hypothesis,
  HypothesisDetailResponse,
  OsfCharacterization,
  ProblemStatement,
  StarStatus,
  UserProfileResponse,
  VoteResponse,
} from "./api-types.js";

export interface RegisterOptions {
  apiUrl: string;
  siteUrl: string;
  getAuthToken?: () => string | undefined;
  authHelp?: string;
}

type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";
type ApiResult<T> = { ok: true; data: T } | { ok: false; result: CallToolResult; status?: number };

const READ_ANNOTATIONS = { readOnlyHint: true, openWorldHint: true } as const;
const WRITE_ANNOTATIONS = { readOnlyHint: false, openWorldHint: true, destructiveHint: false } as const;
const IDEMPOTENT_WRITE_ANNOTATIONS = {
  readOnlyHint: false,
  openWorldHint: true,
  destructiveHint: false,
  idempotentHint: true,
} as const;

const hypothesisStatusSchema = z.enum([
  "proposed",
  "arena_ranked",
  "data_tested",
  "field_validated",
]);
const phaseSchema = z.enum(["live", "completed"]);
const sourceSchema = z.enum(["human", "ai_agent"]);
const sortSchema = z.enum(["newest", "top_rated", "most_discussed"]);
const experimentTypeSchema = z.enum(["observational", "survey", "ab_test", "pre_registered"]);
const experimentStatusSchema = z.enum(["planned", "running", "completed"]);
const voteSchema = z.enum(["a", "b", "tie", "both_weak"]);

const osfSchema = z.object({
  provenance: z.string().min(30).max(8000),
  foreknowledgeExplanation: z.string().max(8000).optional(),
  collectionProcedure: z.string().min(30).max(8000),
  startStopRules: z.string().max(8000).optional(),
  variables: z.string().min(30).max(8000),
  inclusionExclusion: z.string().min(30).max(8000),
  missingData: z.string().min(15).max(8000),
  limitations: z.string().max(8000).optional(),
  tags: z.array(z.string().min(1)).optional(),
});

const experimentResultsSchema = z.object({
  pValue: z.number().optional(),
  effectSize: z.number().optional(),
  sampleSize: z.number().int().positive().optional(),
  confidenceIntervalLow: z.number().optional(),
  confidenceIntervalHigh: z.number().optional(),
  summary: z.string().min(1).max(5000).optional(),
});

function textResult(text: string, isError = false): CallToolResult {
  return { content: [{ type: "text", text }], isError };
}

function idLink(siteUrl: string, kind: "hypothesis" | "experiments" | "data" | "profile", id: string): string {
  return `${siteUrl}/${kind}/${encodeURIComponent(id)}`;
}

function makeQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
}

function domainsText(domains: string[] | string | undefined | null): string {
  if (Array.isArray(domains)) return domains.join(", ");
  return domains ?? "unspecified";
}

function truncate(value: string | undefined | null, length = 180): string {
  const text = value ?? "";
  return text.length > length ? `${text.slice(0, length)}...` : text;
}

function fieldErrorText(errors: ApiErrorBody["errors"]): string | null {
  if (!errors?.length) return null;
  return errors.map((e) => `${e.field}: ${e.message}`).join("; ");
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function extractability(datasetId: string): string {
  const map: Record<string, string> = {
    "ds-1": "Text sentiment, length, readability, named entities (NLP); user karma/history if present; temporal patterns if timestamps exist.",
    "ds-2": "Image brightness, contrast, color distribution; faces/objects/scenes via VLMs; composition features from pixels.",
    "ds-3": "Tweet sentiment, hashtags, mentions, length; engagement metrics; topic and stance features from text.",
    "ds-4": "Image features plus attention-map gaze patterns, fixation duration, and saliency statistics.",
  };
  return map[datasetId] ?? "Derive code-based features from structured columns, NLP/LLM features from text, and VLM features from images when present.";
}

function formatHypothesis(siteUrl: string, h: Hypothesis, heading = "###"): string {
  let text = `${heading} ${h.id}: ${h.statement}\n`;
  text += `- Link: ${idLink(siteUrl, "hypothesis", h.id)}\n`;
  text += `- Status: ${h.status} | Phase: ${h.phase} | Source: ${h.source}${h.agentName ? ` (${h.agentName})` : ""}\n`;
  text += `- Domain: ${domainsText(h.domain)} | Problem: ${h.problemStatement}\n`;
  if (h.winRate != null) text += `- Arena win rate: ${h.winRate}%\n`;
  else if (h.arenaElo != null) text += `- Arena Elo: ${h.arenaElo}\n`;
  if (h.pValue != null || h.effectSize != null) text += `- Evidence: p=${h.pValue ?? "n/a"}, d=${h.effectSize ?? "n/a"}\n`;
  text += `- Comments: ${h.commentCount}${h.experimentCount != null ? ` | Experiments: ${h.experimentCount}` : ""}\n`;
  return text;
}

function formatExperiment(siteUrl: string, e: Experiment, heading = "##"): string {
  let text = `${heading} ${e.id} — ${e.type} (${e.status})\n`;
  text += `- Link: ${idLink(siteUrl, "experiments", e.id)}\n`;
  text += `- Hypothesis: ${e.hypothesisId}\n`;
  if (e.datasetId) text += `- Dataset: ${e.datasetName} (${idLink(siteUrl, "data", e.datasetId)})\n`;
  else text += `- Dataset: ${e.datasetName}\n`;
  text += `- Period: ${e.startedAt}${e.completedAt ? ` to ${e.completedAt}` : " (ongoing)"}\n`;
  if (e.methodology) text += `- Methodology: ${truncate(e.methodology, 260)}\n`;
  if (e.analysisPlan) text += `- Analysis plan: ${truncate(e.analysisPlan, 220)}\n`;
  if (e.results) {
    text += `- Results: p=${e.results.pValue ?? "n/a"}, d=${e.results.effectSize ?? "n/a"}, n=${e.results.sampleSize ?? "n/a"}\n`;
    if (e.results.summary) text += `  ${truncate(e.results.summary, 240)}\n`;
  }
  return text;
}

function authRequiredResult(authHelp: string): CallToolResult {
  return textResult(`Not signed in / token invalid. ${authHelp}`, true);
}

export function registerOpenExperiments(server: McpServer, opts: RegisterOptions): void {
  const apiUrl = opts.apiUrl.replace(/\/$/, "");
  const siteUrl = opts.siteUrl.replace(/\/$/, "");
  const authHelp =
    opts.authHelp ??
    `Create a personal access token at ${siteUrl}/settings/mcp and set OPENEXPERIMENTS_TOKEN.`;

  function hasToken(): boolean {
    return !!opts.getAuthToken?.();
  }

  async function api<T>(
    path: string,
    options: { method?: HttpMethod; body?: unknown; requireAuth?: boolean } = {},
  ): Promise<ApiResult<T>> {
    const token = opts.getAuthToken?.();
    if (options.requireAuth && !token) return { ok: false, result: authRequiredResult(authHelp), status: 401 };

    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(`${apiUrl}${path}`, {
        method: options.method ?? "GET",
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });
      const rawText = await res.text();
      const parsed = rawText ? parseJson(rawText) : undefined;
      if (!res.ok) {
        const body = (parsed && typeof parsed === "object" ? parsed : {}) as ApiErrorBody;
        const message = fieldErrorText(body.errors) ?? body.error ?? rawText.slice(0, 300);
        let text: string;
        if (res.status === 401) text = `Not signed in / token invalid. ${authHelp}`;
        else if (res.status === 403) text = `Forbidden: ${message || "access denied"}. If your profile is incomplete, complete it at ${siteUrl}/complete-profile.`;
        else if (res.status === 404) text = `Not found: ${message || path}`;
        else if (res.status === 409) text = `Conflict: ${message || "request conflicts with existing state"}`;
        else if (res.status === 400 || res.status === 422) text = `Invalid request: ${message || "validation failed"}`;
        else if (res.status === 429) text = "Rate limited by the OpenExperiments API. Try again later.";
        else if (res.status >= 500) text = `API unavailable (${res.status}). Try again later.`;
        else text = `API error ${res.status}: ${message || "unknown error"}`;
        return { ok: false, result: textResult(text, true), status: res.status };
      }
      return { ok: true, data: parsed as T };
    } catch (err) {
      const suffix = err instanceof Error && err.name === "AbortError" ? "request timed out" : err instanceof Error ? err.message : "network error";
      return { ok: false, result: textResult(`API unavailable at ${apiUrl}: ${suffix}`, true) };
    } finally {
      clearTimeout(timeout);
    }
  }

  // Problem statements
  server.registerTool(
    "list_problem_statements",
    {
      title: "List problem statements",
      description: "List all open research questions with linked datasets. Use this first when helping formulate a hypothesis.",
      inputSchema: {},
      annotations: READ_ANNOTATIONS,
    },
    async () => {
      const res = await api<ApiList<ProblemStatement>>("/api/problem-statements?includeDatasets=true");
      if (!res.ok) return res.result;
      let text = `# Problem Statements (${res.data.data.length})\n\n`;
      for (const ps of res.data.data) {
        text += `## ${ps.question}\n- ID: ${ps.id}\n- Domain: ${ps.domain}\n- Hypotheses: ${ps.hypothesisCount}\n- Description: ${ps.description || "n/a"}\n`;
        text += `- Datasets: ${ps.datasets?.length ? ps.datasets.map((d) => `${d.name} (${d.id})`).join(", ") : "None — new datasets needed"}\n\n`;
      }
      return textResult(text);
    },
  );

  // Datasets
  server.registerTool(
    "list_datasets",
    {
      title: "List datasets",
      description: "List Hugging Face datasets, OSF characterization fields, linked problem-statement counts, and extractable features. Filter by free-form domain.",
      inputSchema: { domain: z.string().min(1).max(60).optional().describe("Filter by domain (free-form string)") },
      annotations: READ_ANNOTATIONS,
    },
    async ({ domain }) => {
      const res = await api<ApiList<Dataset>>(`/api/datasets${makeQuery({ domain })}`);
      if (!res.ok) return res.result;
      let text = `# Datasets (${res.data.data.length})\n\n`;
      for (const d of res.data.data) {
        text += `## ${d.name} (${d.id})\n- Link: ${idLink(siteUrl, "data", d.id)}\n- Domain: ${d.domain || "unspecified"}\n- Hugging Face: ${d.huggingfaceUrl || "n/a"}\n`;
        if (d.taskDescription) text += `- Task: ${d.taskDescription}\n`;
        if (d.unitOfAnalysis) text += `- Unit of analysis: ${d.unitOfAnalysis}\n`;
        if (d.foreknowledgeStatus) text += `- Foreknowledge: ${d.foreknowledgeStatus}\n`;
        if (d.dataColumnNames?.length) text += `- Columns: ${d.dataColumnNames.join(", ")}\n`;
        if (d.targetColumnName) text += `- Target: ${d.targetColumnName}\n`;
        if (d.description) text += `- Description: ${truncate(d.description)}\n`;
        text += `- Problem statements: ${d.problemStatementCount ?? 0} | Experiments: ${d.experimentCount ?? 0}\n`;
        text += `- Extractable features: ${extractability(d.id)}\n\n`;
      }
      return textResult(text);
    },
  );

  server.registerTool(
    "get_dataset",
    {
      title: "Get dataset",
      description: "Get full details of a dataset, including schema, OSF characterization, linked problem statements, experiments, and extractability guidance.",
      inputSchema: { datasetId: z.string().min(1).describe("Dataset ID, e.g. ds-1") },
      annotations: READ_ANNOTATIONS,
    },
    async ({ datasetId }) => {
      const res = await api<DatasetDetailResponse>(`/api/datasets/${encodeURIComponent(datasetId)}`);
      if (!res.ok) return res.result;
      const d = res.data.data;
      let text = `# ${d.name} (${d.id})\n\nLink: ${idLink(siteUrl, "data", d.id)}\n\n`;
      text += `- Hugging Face: ${d.huggingfaceUrl || "n/a"}\n- Domain: ${d.domain || "unspecified"}\n`;
      if (d.taskDescription) text += `- Task: ${d.taskDescription}\n`;
      if (d.dataColumnNames?.length) text += `- Columns: ${d.dataColumnNames.join(", ")}\n`;
      if (d.targetColumnName) text += `- Target: ${d.targetColumnName}\n`;
      if (d.unitOfAnalysis) text += `- Unit of analysis: ${d.unitOfAnalysis}\n`;
      if (d.license) text += `- License: ${d.license}\n`;
      if (d.foreknowledgeStatus) text += `- Foreknowledge: ${d.foreknowledgeStatus}\n`;
      if (d.description) text += `\n${d.description}\n`;
      if (d.osfCharacterization) {
        const osf = d.osfCharacterization;
        text += `\n## OSF-style characterization\n- Provenance: ${truncate(osf.provenance, 500)}\n- Collection: ${truncate(osf.collectionProcedure, 500)}\n- Variables: ${truncate(osf.variables, 500)}\n- Inclusion/exclusion: ${truncate(osf.inclusionExclusion, 500)}\n- Missing data: ${truncate(osf.missingData, 500)}\n`;
      }
      text += `\n## Extractable Features\n${extractability(d.id)}\n\n`;
      text += `## Problem Statements (${res.data.problemStatements.length})\n`;
      for (const ps of res.data.problemStatements) text += `- ${ps.question} (${ps.id}, ${ps.domain}, ${ps.hypothesisCount} hypotheses)\n`;
      text += `\n## Experiments (${res.data.experiments.length})\n`;
      for (const exp of res.data.experiments) text += `- ${exp.id}: ${exp.type} (${exp.status}) testing ${exp.hypothesisId} — ${truncate(exp.methodology, 120)}\n`;
      return textResult(text);
    },
  );

  server.registerTool(
    "submit_dataset",
    {
      title: "Submit dataset",
      description: "Register a dataset. Before calling, show the user the exact dataset fields and OSF characterization that will be submitted and get explicit confirmation.",
      inputSchema: {
        name: z.string().min(3).max(120),
        huggingfaceUrl: z.string().url().regex(/^https?:\/\/huggingface\.co\/datasets\/[\w.-]+(\/[\w.-]+)?\/?$/i, "Must be a Hugging Face dataset URL"),
        description: z.string().min(1).max(2000).optional(),
        domain: z.string().min(2).max(60).optional(),
        license: z.string().max(100).optional(),
        foreknowledgeStatus: z.enum([
          "data_not_exist",
          "data_inaccessible",
          "data_unobserved",
          "others_observed",
          "limited_observation",
          "observed_not_analyzed",
          "observed_cannot_certify",
          "analyses_conducted",
        ]),
        unitOfAnalysis: z.string().min(3).max(300),
        osf: osfSchema,
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (input) => {
      const body = { ...input, osf: { ...input.osf, tags: input.osf.tags ?? [] } };
      const res = await api<ApiData<{ id: string }>>("/api/datasets", { method: "POST", body, requireAuth: true });
      if (!res.ok) return res.result;
      return textResult(`Dataset registered: ${res.data.data.id}\n\n${idLink(siteUrl, "data", res.data.data.id)}`);
    },
  );

  // Hypotheses
  server.registerTool(
    "browse_hypotheses",
    {
      title: "Browse hypotheses",
      description: "Browse hypotheses with the full filter set from the Explore page: domain, phase, status, problem statement search, free-text search, sort, and pagination.",
      inputSchema: {
        domain: z.string().min(1).max(60).optional(),
        phase: phaseSchema.optional(),
        status: hypothesisStatusSchema.optional(),
        problemStatement: z.string().min(1).max(500).optional().describe("Problem statement text to search/filter"),
        search: z.string().min(1).max(300).optional(),
        sort: sortSchema.optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ domain, phase, status, problemStatement, search, sort, limit, offset }) => {
      const effectiveSearch = search ?? problemStatement;
      const res = await api<ApiList<Hypothesis>>(
        `/api/hypotheses${makeQuery({ domain, phase, status, search: effectiveSearch, sort, limit: limit ?? 50, offset })}`,
      );
      if (!res.ok) return res.result;
      let text = `# Hypotheses (${res.data.data.length}${res.data.total != null ? ` of ${res.data.total}` : ""})\n\n`;
      for (const h of res.data.data) text += `${formatHypothesis(siteUrl, h)}\n`;
      return textResult(text);
    },
  );

  server.registerTool(
    "search_hypotheses",
    {
      title: "Search hypotheses",
      description: "Search hypotheses by keyword across statements, rationales, and problem statements. Kept for backwards compatibility; supports domain, phase, status, and limit.",
      inputSchema: {
        query: z.string().min(1).max(300).describe("Search keywords"),
        domain: z.string().min(1).max(60).optional(),
        phase: phaseSchema.optional(),
        status: hypothesisStatusSchema.optional(),
        limit: z.number().int().min(1).max(100).optional(),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ query, domain, phase, status, limit }) => {
      const res = await api<ApiList<Hypothesis>>(
        `/api/hypotheses${makeQuery({ search: query, domain, phase, status, limit: limit ?? 20 })}`,
      );
      if (!res.ok) return res.result;
      let text = `# Search: "${query}" — ${res.data.data.length}${res.data.total != null ? ` of ${res.data.total}` : ""} results\n\n`;
      for (const h of res.data.data) text += `${formatHypothesis(siteUrl, h)}\n`;
      return textResult(text);
    },
  );

  server.registerTool(
    "get_hypothesis",
    {
      title: "Get hypothesis",
      description: "Get full details of a hypothesis: statement, rationale, experiments with results, comments, citations, and site link.",
      inputSchema: { hypothesisId: z.string().min(1).describe("Hypothesis ID") },
      annotations: READ_ANNOTATIONS,
    },
    async ({ hypothesisId }) => {
      const res = await api<HypothesisDetailResponse>(`/api/hypotheses/${encodeURIComponent(hypothesisId)}`);
      if (!res.ok) return res.result;
      const h = res.data.data;
      let text = `# Hypothesis ${h.id}\n\n${idLink(siteUrl, "hypothesis", h.id)}\n\n`;
      text += `**Statement:** ${h.statement}\n\n**Rationale:** ${h.rationale}\n\n`;
      text += `- Status: ${h.status} | Phase: ${h.phase}\n- Source: ${h.source}${h.agentName ? ` (${h.agentName})` : ""}\n- Domain: ${domainsText(h.domain)}\n- Problem: ${h.problemStatement}\n- Submitted: ${h.submittedAt}\n`;
      if (h.winRate != null) text += `- Win rate: ${h.winRate}%\n`;
      if (h.evidenceScore != null) text += `- Evidence score: ${h.evidenceScore}\n`;
      if (h.pValue != null || h.effectSize != null) text += `- Evidence: p=${h.pValue ?? "n/a"}, d=${h.effectSize ?? "n/a"}\n`;
      if (h.citationDois.length) text += `- Citations: ${h.citationDois.join(", ")}\n`;
      if (h.relatedHypothesisIds.length) text += `- Related: ${h.relatedHypothesisIds.join(", ")}\n`;
      text += `\n## Experiments (${res.data.experiments.length})\n\n`;
      for (const exp of res.data.experiments) text += `${formatExperiment(siteUrl, exp, "###")}\n`;
      text += `## Comments (${res.data.comments.length})\n`;
      for (const c of res.data.comments) text += `- ${c.body}${c.doi ? ` [${c.doi}]` : ""}${c.parentId ? ` (reply to ${c.parentId})` : ""}\n`;
      return textResult(text);
    },
  );

  server.registerTool(
    "submit_hypothesis",
    {
      title: "Submit hypothesis",
      description: "Submit a hypothesis. Before calling, show the user the exact statement, rationale, problem statement, domains, source, citations, and anonymity setting and get explicit confirmation.",
      inputSchema: {
        statement: z.string().min(10).max(2000),
        rationale: z.string().min(10).max(5000),
        problemStatement: z.string().min(5).max(500),
        domains: z.array(z.string().min(1).max(60)).min(1),
        source: sourceSchema.optional(),
        agentName: z.string().min(1).max(100).optional(),
        citationDois: z.array(z.string().min(1)).optional(),
        isAnonymous: z.boolean().optional(),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (input) => {
      const body = { ...input, source: input.source ?? "human" };
      const res = await api<ApiData<{ id: string }>>("/api/hypotheses", { method: "POST", body, requireAuth: true });
      if (!res.ok) return res.result;
      return textResult(`Hypothesis submitted: ${res.data.data.id}\n\n${idLink(siteUrl, "hypothesis", res.data.data.id)}`);
    },
  );

  server.registerTool(
    "add_citation",
    {
      title: "Add citation",
      description: "Add a DOI or arXiv URL citation to one of the user's hypotheses. Before calling, show the exact hypothesis ID and citation and get explicit confirmation.",
      inputSchema: {
        hypothesisId: z.string().min(1),
        citation: z.string().min(1).describe("DOI (10.xxxx/...) or arXiv URL"),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ hypothesisId, citation }) => {
      const res = await api<ApiData<{ citationDois: string[] }>>(`/api/hypotheses/${encodeURIComponent(hypothesisId)}`, {
        method: "PATCH",
        body: { addCitation: citation },
        requireAuth: true,
      });
      if (!res.ok) return res.result;
      return textResult(`Citation added to ${hypothesisId}.\n\nCitations: ${res.data.data.citationDois.join(", ")}\n${idLink(siteUrl, "hypothesis", hypothesisId)}`);
    },
  );

  server.registerTool(
    "generate_submission_url",
    {
      title: "Generate submission URL",
      description: "Generate a pre-filled submit-page URL. Use when not authenticated or when the user prefers to review in the browser.",
      inputSchema: {
        statement: z.string().min(10).max(2000),
        rationale: z.string().min(10).max(5000),
        problemStatementId: z.string().optional(),
        customProblemStatement: z.string().min(5).max(500).optional(),
        domains: z.array(z.string().min(1).max(60)).min(1),
        source: sourceSchema.optional(),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ statement, rationale, problemStatementId, customProblemStatement, domains, source }) => {
      const params = new URLSearchParams();
      params.set("statement", statement);
      params.set("rationale", rationale);
      params.set("domains", domains.join(","));
      if (problemStatementId) params.set("ps", problemStatementId);
      if (customProblemStatement) params.set("customPS", customProblemStatement);
      if (source) params.set("source", source);
      const url = `${siteUrl}/submit?${params.toString()}`;
      let text = `## Ready to Submit\n\n${url}\n\n- Statement: ${statement}\n- Rationale: ${truncate(rationale, 220)}\n- Problem: ${problemStatementId || customProblemStatement || "not specified"}\n- Domains: ${domains.join(", ")}\n- Source: ${source || "human"}\n`;
      const nonStandard = domains.filter((d) => !["persuasion", "memorability"].includes(d.toLowerCase()));
      if (nonStandard.length) text += `\nNote: ${nonStandard.join(", ")} are non-standard domains. The site supports proposing new problem statements/domains; review carefully before submitting.\n`;
      return textResult(text);
    },
  );

  server.registerTool(
    "get_my_hypotheses",
    {
      title: "Get my hypotheses",
      description: "List hypotheses submitted by the authenticated user.",
      inputSchema: {},
      annotations: READ_ANNOTATIONS,
    },
    async () => {
      if (!hasToken()) return authRequiredResult(authHelp);
      const res = await api<ApiList<Hypothesis>>("/api/hypotheses?mine=true", { requireAuth: true });
      if (!res.ok) return res.result;
      if (res.data.data.length === 0) return textResult("You haven't submitted any hypotheses yet.");
      let text = `# My Hypotheses (${res.data.data.length}${res.data.total != null ? ` of ${res.data.total}` : ""})\n\n`;
      for (const h of res.data.data) text += `${formatHypothesis(siteUrl, h)}\n`;
      return textResult(text);
    },
  );

  // Comments
  server.registerTool(
    "list_comments",
    {
      title: "List comments",
      description: "List discussion comments for a hypothesis.",
      inputSchema: { hypothesisId: z.string().min(1) },
      annotations: READ_ANNOTATIONS,
    },
    async ({ hypothesisId }) => {
      const res = await api<ApiList<Comment>>(`/api/comments${makeQuery({ hypothesisId })}`);
      if (!res.ok) return res.result;
      let text = `# Comments on ${hypothesisId} (${res.data.data.length})\n\n${idLink(siteUrl, "hypothesis", hypothesisId)}\n\n`;
      for (const c of res.data.data) {
        text += `- ${c.id}${c.parentId ? ` (reply to ${c.parentId})` : ""} by ${c.author?.name ?? "Anonymous"} on ${c.createdAt}: ${c.body}${c.doi ? ` [${c.doi}]` : ""}\n`;
      }
      return textResult(text);
    },
  );

  server.registerTool(
    "post_comment",
    {
      title: "Post comment",
      description: "Post a comment or reply. Before calling, show the user the exact comment text, DOI, hypothesis ID, and parent ID (if any) and get explicit confirmation.",
      inputSchema: {
        hypothesisId: z.string().min(1),
        content: z.string().min(1).max(5000),
        doi: z.string().min(1).optional(),
        parentId: z.string().min(1).optional(),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (input) => {
      const res = await api<ApiData<Comment & { author: { id: string; name: string | null; avatarUrl: string | null } }>>("/api/comments", {
        method: "POST",
        body: input,
        requireAuth: true,
      });
      if (!res.ok) return res.result;
      return textResult(`Comment posted: ${res.data.data.id}\n\n${idLink(siteUrl, "hypothesis", input.hypothesisId)}`);
    },
  );

  // Stars
  server.registerTool(
    "get_star_status",
    {
      title: "Get star status",
      description: "Get star count and authenticated user's starred state for a hypothesis.",
      inputSchema: { hypothesisId: z.string().min(1) },
      annotations: READ_ANNOTATIONS,
    },
    async ({ hypothesisId }) => {
      const res = await api<ApiData<StarStatus>>(`/api/hypotheses/${encodeURIComponent(hypothesisId)}/star`);
      if (!res.ok) return res.result;
      return textResult(`${hypothesisId}: ${res.data.data.count} stars; starred by you: ${res.data.data.starred ? "yes" : "no"}.`);
    },
  );

  server.registerTool(
    "star_hypothesis",
    {
      title: "Star hypothesis",
      description: "Idempotently star a hypothesis. Before calling, show the user the exact hypothesis ID and get explicit confirmation.",
      inputSchema: { hypothesisId: z.string().min(1) },
      annotations: IDEMPOTENT_WRITE_ANNOTATIONS,
    },
    async ({ hypothesisId }) => {
      const current = await api<ApiData<StarStatus>>(`/api/hypotheses/${encodeURIComponent(hypothesisId)}/star`, { requireAuth: true });
      if (!current.ok) return current.result;
      if (current.data.data.starred) return textResult(`Already starred ${hypothesisId}. Count: ${current.data.data.count}.`);
      const res = await api<ApiData<StarStatus>>(`/api/hypotheses/${encodeURIComponent(hypothesisId)}/star`, { method: "POST", requireAuth: true });
      if (!res.ok) return res.result;
      return textResult(`Starred ${hypothesisId}. Count: ${res.data.data.count}.\n${idLink(siteUrl, "hypothesis", hypothesisId)}`);
    },
  );

  server.registerTool(
    "unstar_hypothesis",
    {
      title: "Unstar hypothesis",
      description: "Idempotently unstar a hypothesis. Before calling, show the user the exact hypothesis ID and get explicit confirmation.",
      inputSchema: { hypothesisId: z.string().min(1) },
      annotations: IDEMPOTENT_WRITE_ANNOTATIONS,
    },
    async ({ hypothesisId }) => {
      const current = await api<ApiData<StarStatus>>(`/api/hypotheses/${encodeURIComponent(hypothesisId)}/star`, { requireAuth: true });
      if (!current.ok) return current.result;
      if (!current.data.data.starred) return textResult(`Already not starred ${hypothesisId}. Count: ${current.data.data.count}.`);
      const res = await api<ApiData<StarStatus>>(`/api/hypotheses/${encodeURIComponent(hypothesisId)}/star`, { method: "POST", requireAuth: true });
      if (!res.ok) return res.result;
      return textResult(`Unstarred ${hypothesisId}. Count: ${res.data.data.count}.\n${idLink(siteUrl, "hypothesis", hypothesisId)}`);
    },
  );

  // Arena
  server.registerTool(
    "get_arena_rankings",
    {
      title: "Get arena rankings",
      description: "Get the arena leaderboard: top completed hypotheses ranked by community win rate.",
      inputSchema: {},
      annotations: READ_ANNOTATIONS,
    },
    async () => {
      const res = await api<ApiList<ArenaRanking>>("/api/arena/rankings");
      if (!res.ok) return res.result;
      let text = `# Arena Rankings — Top ${res.data.data.length}\n\n| # | ID | Win% | Domain | Hypothesis |\n|---|---|---:|---|---|\n`;
      res.data.data.forEach((h, i) => {
        text += `| ${i + 1} | [${h.id}](${idLink(siteUrl, "hypothesis", h.id)}) | ${h.winRate}% | ${domainsText(h.domain)} | ${truncate(h.statement, 90)} |\n`;
      });
      text += `\nArena: ${siteUrl}/arena`;
      return textResult(text);
    },
  );

  server.registerTool(
    "get_arena_matchup",
    {
      title: "Get arena matchup",
      description: "Get a random pair of hypotheses to judge in the arena.",
      inputSchema: {},
      annotations: READ_ANNOTATIONS,
    },
    async () => {
      const res = await api<ApiData<ArenaMatchup>>("/api/arena/matchup");
      if (!res.ok) return res.result;
      const m = res.data.data;
      let text = `# Arena Matchup ${m.id}\n\nArena: ${siteUrl}/arena\n\n`;
      if (m.hypothesisA) text += `## A: ${m.hypothesisA.statement}\n- ID: ${m.hypothesisA.id}\n- Domain: ${domainsText(m.hypothesisA.domain)}\n- Link: ${idLink(siteUrl, "hypothesis", m.hypothesisA.id)}\n\n`;
      if (m.hypothesisB) text += `## B: ${m.hypothesisB.statement}\n- ID: ${m.hypothesisB.id}\n- Domain: ${domainsText(m.hypothesisB.domain)}\n- Link: ${idLink(siteUrl, "hypothesis", m.hypothesisB.id)}\n\n`;
      text += `Current votes: A ${m.votesA}, B ${m.votesB}, Tie ${m.votesTie}, Total ${m.totalVotes}.`;
      return textResult(text);
    },
  );

  server.registerTool(
    "vote_arena",
    {
      title: "Vote arena",
      description: "Cast an arena vote. Before calling, show the user the matchup ID, both hypothesis IDs/statements, and selected vote, then get explicit confirmation.",
      inputSchema: { matchupId: z.string().min(1), vote: voteSchema },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ matchupId, vote }) => {
      const body: { matchupId: string; vote: ArenaVote } = { matchupId, vote };
      const res = await api<ApiData<VoteResponse>>("/api/arena/vote", {
        method: "POST",
        body,
        requireAuth: true,
      });
      if (!res.ok) return res.result;
      return textResult(`Vote recorded for matchup ${res.data.data.id}. Total votes: ${res.data.data.totalVotes}.\n${siteUrl}/arena`);
    },
  );

  // Experiments
  server.registerTool(
    "list_experiments",
    {
      title: "List experiments",
      description: "List experiments with methodology, dataset, status, submitter, and results. Optionally filter by hypothesis ID with pagination.",
      inputSchema: {
        hypothesisId: z.string().min(1).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).optional(),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ hypothesisId, limit, offset }) => {
      const res = await api<ApiList<Experiment>>(`/api/experiments${makeQuery({ hypothesisId, limit, offset })}`);
      if (!res.ok) return res.result;
      let text = `# Experiments (${res.data.data.length})\n\n`;
      for (const e of res.data.data) text += `${formatExperiment(siteUrl, e)}\n`;
      return textResult(text);
    },
  );

  server.registerTool(
    "get_experiment",
    {
      title: "Get experiment",
      description: "Get full details of an experiment, including selected version, version history, statistical results, and linked hypothesis.",
      inputSchema: {
        experimentId: z.string().min(1),
        version: z.number().int().positive().optional(),
      },
      annotations: READ_ANNOTATIONS,
    },
    async ({ experimentId, version }) => {
      const res = await api<ExperimentDetailResponse>(`/api/experiments/${encodeURIComponent(experimentId)}${makeQuery({ version })}`);
      if (!res.ok) return res.result;
      const e = res.data.data;
      let text = `# Experiment ${e.id}\n\n${idLink(siteUrl, "experiments", e.id)}\n\n`;
      text += formatExperiment(siteUrl, e, "##");
      if (res.data.hypothesis) text += `\n## Linked Hypothesis\n[${res.data.hypothesis.id}](${idLink(siteUrl, "hypothesis", res.data.hypothesis.id)}): ${res.data.hypothesis.statement}\n`;
      if (res.data.versions?.length) {
        text += `\n## Versions\n`;
        for (const v of res.data.versions) text += `- v${v.version} (${v.status}) ${v.createdAt}${v.changeSummary ? ` — ${v.changeSummary}` : ""}\n`;
      }
      return textResult(text);
    },
  );

  server.registerTool(
    "submit_experiment",
    {
      title: "Submit experiment",
      description: "Submit an experiment. Before calling, show the user the exact hypothesis, dataset, status, methodology, analysis plan, OSF link, and results being submitted and get explicit confirmation.",
      inputSchema: {
        hypothesisId: z.string().min(1),
        problemStatementId: z.string().min(1).optional(),
        type: experimentTypeSchema,
        datasetId: z.string().min(1).optional(),
        datasetName: z.string().min(1).max(200).optional(),
        status: experimentStatusSchema.optional(),
        methodology: z.string().min(1).max(10000).optional(),
        analysisPlan: z.string().min(1).max(10000).optional(),
        osfLink: z.string().url().optional(),
        results: experimentResultsSchema.optional(),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async (input) => {
      const res = await api<ApiData<{ id: string }>>("/api/experiments", { method: "POST", body: input, requireAuth: true });
      if (!res.ok) return res.result;
      return textResult(`Experiment submitted: ${res.data.data.id}\n\n${idLink(siteUrl, "experiments", res.data.data.id)}`);
    },
  );

  server.registerTool(
    "update_experiment",
    {
      title: "Update experiment",
      description: "Update an experiment and create a new version. Before calling, show the user the exact status, methodology, analysis plan, OSF link, results, and change summary and get explicit confirmation.",
      inputSchema: {
        experimentId: z.string().min(1),
        status: experimentStatusSchema.optional(),
        methodology: z.string().min(1).max(10000).optional(),
        analysisPlan: z.string().min(1).max(10000).optional(),
        osfLink: z.string().url().optional(),
        results: experimentResultsSchema.optional(),
        changeSummary: z.string().min(1).max(500).optional(),
      },
      annotations: WRITE_ANNOTATIONS,
    },
    async ({ experimentId, ...body }) => {
      const res = await api<ApiData<{ id: string; version: number }>>(`/api/experiments/${encodeURIComponent(experimentId)}`, {
        method: "PATCH",
        body,
        requireAuth: true,
      });
      if (!res.ok) return res.result;
      return textResult(`Experiment ${res.data.data.id} updated to version ${res.data.data.version}.\n${idLink(siteUrl, "experiments", res.data.data.id)}`);
    },
  );

  // Account and users
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description: "Show the authenticated OpenExperiments user or explain how to authenticate.",
      inputSchema: {},
      annotations: READ_ANNOTATIONS,
    },
    async () => {
      if (!hasToken()) return textResult(`You are not signed in. ${authHelp}`);
      const res = await api<AuthMeResponse>("/api/auth/me", { requireAuth: true });
      if (!res.ok) return res.result;
      if (!res.data.user) {
        return textResult(`The configured OpenExperiments token is invalid, expired, or revoked. ${authHelp}`, true);
      }
      return textResult(`# Signed in\n\n- ID: ${res.data.user.id}\n- Name: ${res.data.user.name ?? "(no name)"}\n- Email: ${res.data.user.email ?? "(hidden)"}\n- Profile completed: ${res.data.user.profileCompleted ? "yes" : "no"}\n- Profile: ${idLink(siteUrl, "profile", res.data.user.id)}`);
    },
  );

  server.registerTool(
    "get_user_profile",
    {
      title: "Get user profile",
      description: "Get a public user profile, contribution stats, submitted hypotheses, and starred hypotheses visible to the requester.",
      inputSchema: { userId: z.string().min(1) },
      annotations: READ_ANNOTATIONS,
    },
    async ({ userId }) => {
      const res = await api<UserProfileResponse>(`/api/users/${encodeURIComponent(userId)}`);
      if (!res.ok) return res.result;
      const p = res.data.data;
      let text = `# ${p.user.name ?? "Anonymous"}\n\n${idLink(siteUrl, "profile", p.user.id)}\n\n`;
      text += `- ID: ${p.user.id}\n- Joined: ${p.user.joinedAt}\n- Position: ${p.user.position ?? "n/a"}\n- Affiliation: ${p.user.affiliation ?? "n/a"}\n- Website: ${p.user.website ?? "n/a"}\n- Scholar: ${p.user.scholarUrl ?? "n/a"}\n- ORCID: ${p.user.orcid ?? "n/a"}\n- X/Twitter: ${p.user.twitterHandle ?? "n/a"}\n- Bio: ${p.user.bio ?? "n/a"}\n`;
      text += `\n## Stats\n- Hypotheses: ${p.stats.hypothesisCount}\n- Experiments: ${p.stats.experimentCount}\n- Comments: ${p.stats.commentCount}\n- Arena votes: ${p.stats.voteCount}\n`;
      text += `\n## Hypotheses (${p.hypotheses.length})\n`;
      for (const h of p.hypotheses) text += `- [${h.id}](${idLink(siteUrl, "hypothesis", h.id)}): ${h.statement} (${h.status}, ${h.phase}, ${domainsText(h.domain)})${h.isAnonymous ? " [anonymous]" : ""}\n`;
      text += `\n## Starred (${p.starredHypotheses.length})\n`;
      for (const h of p.starredHypotheses) text += `- [${h.id}](${idLink(siteUrl, "hypothesis", h.id)}): ${h.statement}\n`;
      return textResult(text);
    },
  );

  server.registerTool(
    "update_my_profile",
    {
      title: "Update my profile",
      description: "Update the authenticated user's profile. Only the fields you pass are changed; other fields keep their current values (use clearFields to remove a value). Before calling, show the user the exact profile fields that will be changed and get explicit confirmation.",
      inputSchema: {
        name: z.string().min(2).max(100).optional(),
        position: z.string().min(2).max(100).optional(),
        scholarUrl: z.string().url().optional(),
        website: z.string().url().optional(),
        bio: z.string().min(1).max(500).optional(),
        orcid: z.string().regex(/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/).optional(),
        twitterHandle: z.string().regex(/^@?[a-zA-Z0-9_]{1,15}$/).optional(),
        clearFields: z
          .array(z.enum(["position", "scholarUrl", "website", "bio", "orcid", "twitterHandle"]))
          .optional()
          .describe("Optional fields to clear. Fields that are not provided keep their current values."),
      },
      annotations: IDEMPOTENT_WRITE_ANNOTATIONS,
    },
    async ({ clearFields, ...changes }) => {
      const me = await api<AuthMeResponse>("/api/auth/me", { requireAuth: true });
      if (!me.ok) return me.result;
      if (!me.data.user) return authRequiredResult(authHelp);
      const userPath = `/api/users/${encodeURIComponent(me.data.user.id)}`;
      // The API replaces the whole profile, so merge the requested changes over
      // the current values to avoid wiping fields the user did not mention.
      const current = await api<UserProfileResponse>(userPath, { requireAuth: true });
      if (!current.ok) return current.result;
      const u = current.data.data.user;
      const merged: Record<string, string | null> = {
        name: u.name,
        position: u.position,
        scholarUrl: u.scholarUrl,
        website: u.website,
        bio: u.bio,
        orcid: u.orcid,
        twitterHandle: u.twitterHandle,
      };
      for (const [key, value] of Object.entries(changes)) {
        if (value !== undefined) merged[key] = value;
      }
      for (const key of clearFields ?? []) merged[key] = null;
      const res = await api<{ ok: boolean }>(userPath, { method: "PATCH", body: merged, requireAuth: true });
      if (!res.ok) return res.result;
      const changed = [...Object.keys(changes).filter((k) => changes[k as keyof typeof changes] !== undefined), ...(clearFields ?? []).map((k) => `${k} (cleared)`)];
      return textResult(`Profile updated${changed.length ? `: ${changed.join(", ")}` : ""}.\n${idLink(siteUrl, "profile", me.data.user.id)}`);
    },
  );

  // Platform overview
  server.registerTool(
    "platform_overview",
    {
      title: "Platform overview",
      description: "High-level overview of OpenExperiments: current stats, domains, hypothesis lifecycle, feature extractability philosophy, and workflow.",
      inputSchema: {},
      annotations: READ_ANNOTATIONS,
    },
    async () => {
      const [hypRes, psRes, dsRes, expRes, arenaRes] = await Promise.all([
        api<ApiList<Hypothesis>>("/api/hypotheses?limit=100"),
        api<ApiList<ProblemStatement>>("/api/problem-statements?includeDatasets=true"),
        api<ApiList<Dataset>>("/api/datasets"),
        api<ApiList<Experiment>>("/api/experiments?limit=100"),
        api<ApiList<ArenaRanking>>("/api/arena/rankings"),
      ]);
      const firstError = [hypRes, psRes, dsRes, expRes, arenaRes].find((r) => !r.ok);
      if (firstError && !firstError.ok) return firstError.result;
      if (!hypRes.ok || !psRes.ok || !dsRes.ok || !expRes.ok || !arenaRes.ok) return textResult("API unavailable", true);
      const hyps = hypRes.data.data;
      const statusCounts = {
        proposed: hyps.filter((h) => h.status === "proposed").length,
        arena_ranked: hyps.filter((h) => h.status === "arena_ranked").length,
        data_tested: hyps.filter((h) => h.status === "data_tested").length,
        field_validated: hyps.filter((h) => h.status === "field_validated").length,
      };
      let text = `# OpenExperiments Platform Overview\n\nWebsite: ${siteUrl}\n\n`;
      text += `OpenExperiments is a platform where researchers propose hypotheses, rank them in pairwise arenas, test them on datasets, discuss evidence, and cite results.\n\n`;
      text += `## Stats\n| Metric | Count |\n|---|---:|\n| Hypotheses | ${hypRes.data.total ?? hyps.length} |\n| Problem Statements | ${psRes.data.data.length} |\n| Datasets | ${dsRes.data.data.length} |\n| Experiments | ${expRes.data.data.length} |\n| Arena Ranked | ${arenaRes.data.data.length} |\n\n`;
      text += `## Lifecycle\nproposed → arena_ranked → data_tested → field_validated\n\n`;
      text += `- Proposed: ${statusCounts.proposed}\n- Arena ranked: ${statusCounts.arena_ranked}\n- Data tested: ${statusCounts.data_tested}\n- Field validated: ${statusCounts.field_validated}\n\n`;
      text += `## ExperiGen Feature Extractability\nHypotheses should test features computable from available data: brightness/color from pixels, sentiment/readability from text, face/object counts via VLMs, and correlations from structured columns. Avoid claims requiring unobserved mood, intent, demographics, or cultural context unless new data will be collected.\n\n`;
      text += `## Workflow\n1. Browse problem statements and datasets.\n2. Formulate a specific, falsifiable hypothesis with an extraction method.\n3. Submit or generate a review URL.\n4. Vote/comment in the arena.\n5. Design and submit experiments with versions/results.\n`;
      return textResult(text);
    },
  );

  // Prompts
  server.registerPrompt(
    "formulate-hypothesis",
    {
      title: "Formulate hypothesis",
      description: "Load OpenExperiments context and help turn a rough idea into a testable hypothesis; after confirmation submit when authenticated or generate a URL.",
      argsSchema: { idea: z.string().optional().describe("The user's rough idea or area of interest") },
    },
    async ({ idea }) => {
      const [psRes, dsRes, hypRes] = await Promise.all([
        api<ApiList<ProblemStatement>>("/api/problem-statements?includeDatasets=true"),
        api<ApiList<Dataset>>("/api/datasets"),
        api<ApiList<Hypothesis>>("/api/hypotheses?sort=top_rated&limit=30"),
      ]);
      let ctx = "You are helping formulate a testable OpenExperiments hypothesis. After the user explicitly confirms the final content, call submit_hypothesis if authenticated; if not authenticated or the user wants browser review, call generate_submission_url.\n\n";
      ctx += "A strong hypothesis is specific, falsifiable, grounded, novel, and tests features computable from available data. Explain how each predictor/outcome can be extracted.\n\n";
      if (idea) ctx += `User idea: ${idea}\n\n`;
      if (psRes.ok) {
        ctx += "## Problem Statements\n";
        for (const ps of psRes.data.data) ctx += `- ${ps.id}: ${ps.question} (${ps.domain}, ${ps.hypothesisCount} hypotheses)\n`;
      }
      if (dsRes.ok) {
        ctx += "\n## Datasets\n";
        for (const d of dsRes.data.data) ctx += `- ${d.id}: ${d.name}; extractable: ${extractability(d.id)}\n`;
      }
      if (hypRes.ok) {
        ctx += "\n## Example / duplicate-check hypotheses\n";
        for (const h of hypRes.data.data.slice(0, 10)) ctx += `- ${h.id}: ${h.statement} (${domainsText(h.domain)}, ${h.status})\n`;
      }
      ctx += "\nWorkflow: ask clarifying questions if needed, check duplicates with search_hypotheses, draft statement/rationale/problem/domains/citations/anonymity, show exact content, get explicit confirmation, then submit_hypothesis or generate_submission_url.";
      return { messages: [{ role: "user", content: { type: "text", text: ctx } }] };
    },
  );

  server.registerPrompt(
    "co-ideate",
    {
      title: "Co-ideate",
      description: "Brainstorm new hypothesis ideas from existing hypotheses, results, arena rankings, comments, and extractability gaps.",
      argsSchema: { domain: z.string().optional().describe("Focus on a specific free-form domain") },
    },
    async ({ domain }) => {
      const [hypRes, psRes] = await Promise.all([
        api<ApiList<Hypothesis>>(`/api/hypotheses${makeQuery({ sort: "top_rated", limit: 20, domain })}`),
        api<ApiList<ProblemStatement>>("/api/problem-statements?includeDatasets=true"),
      ]);
      let ctx = "Co-ideate research hypotheses for OpenExperiments. Consider arena voting and commenting as ways to refine ideas. Prioritize computable features and identify data gaps.\n\n";
      if (domain) ctx += `Focus domain: ${domain}\n\n`;
      if (hypRes.ok) {
        ctx += "## Existing hypotheses\n";
        for (const h of hypRes.data.data) ctx += `- ${h.statement} (${h.status}, ${domainsText(h.domain)}, comments ${h.commentCount})\n`;
      }
      if (psRes.ok) {
        ctx += "\n## Open questions\n";
        for (const ps of psRes.data.data) ctx += `- ${ps.question} (${ps.domain})\n`;
      }
      ctx += "\nSuggest 2-3 directions, note extraction method, then when the user picks one follow formulate-hypothesis workflow.";
      return { messages: [{ role: "user", content: { type: "text", text: ctx } }] };
    },
  );

  server.registerPrompt(
    "review-arena",
    {
      title: "Review arena",
      description: "Guide the user through judging arena matchups using get_arena_matchup and vote_arena.",
      argsSchema: {},
    },
    async () => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: "Guide the user through OpenExperiments arena judging. Call get_arena_matchup, present both hypotheses neutrally, ask for A/B/tie/both_weak, then show the exact matchup and selected vote and get explicit confirmation before vote_arena. After voting, offer another matchup or get_arena_rankings.",
          },
        },
      ],
    }),
  );

  server.registerPrompt(
    "design-experiment",
    {
      title: "Design experiment",
      description: "Plan an experiment for a hypothesis on a dataset, then submit_experiment after confirmation.",
      argsSchema: {
        hypothesisId: z.string().optional(),
        datasetId: z.string().optional(),
      },
    },
    async ({ hypothesisId, datasetId }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Design an OpenExperiments experiment${hypothesisId ? ` for hypothesis ${hypothesisId}` : ""}${datasetId ? ` using dataset ${datasetId}` : ""}. Gather/inspect hypothesis and dataset details, specify type, dataset, methodology, analysis plan, OSF link if available, and optional results. Show exact payload and get explicit confirmation before submit_experiment. If updating an existing experiment, use update_experiment after confirmation.`,
          },
        },
      ],
    }),
  );

  // Resources
  server.registerResource(
    "platform-guide",
    "openexperiments://guide",
    {
      title: "OpenExperiments guide",
      description: "Guide to OpenExperiments workflows, tools, prompts, resources, lifecycle, datasets, arena, and auth.",
      mimeType: "text/markdown",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "text/markdown",
          text: `# OpenExperiments MCP Guide

OpenExperiments supports hypothesis submission/discovery, arena voting, experiments with versions/results, datasets with OSF-style characterization, comments, stars, citations, and profiles.

## Tools

### Read-only
- whoami
- platform_overview
- list_problem_statements
- list_datasets / get_dataset
- browse_hypotheses / search_hypotheses / get_hypothesis / get_my_hypotheses
- list_comments
- get_star_status
- get_arena_rankings / get_arena_matchup
- list_experiments / get_experiment
- get_user_profile
- generate_submission_url

### Writes (auth required unless noted)
- submit_hypothesis, add_citation
- post_comment
- star_hypothesis, unstar_hypothesis
- vote_arena (public API may accept anonymous votes)
- submit_experiment, update_experiment
- submit_dataset
- update_my_profile

Write tools require the assistant to show exact content and obtain explicit user confirmation before calling.

## Prompts
- formulate-hypothesis
- co-ideate
- review-arena
- design-experiment

## Resources
- openexperiments://guide
- openexperiments://hypothesis/{id}

## Feature extractability
A good hypothesis tests computable features: color/brightness from pixels, sentiment/readability from text, faces/objects via VLMs, or statistics from structured columns. Avoid claims requiring unobserved data unless proposing new data collection.

## Auth
Create a personal access token at ${siteUrl}/settings/mcp and set OPENEXPERIMENTS_TOKEN. Remote OAuth connectors provide a token automatically.
`,
        },
      ],
    }),
  );

  server.registerResource(
    "hypothesis-template",
    new ResourceTemplate("openexperiments://hypothesis/{id}", { list: undefined }),
    {
      title: "Hypothesis resource",
      description: "Fetch a hypothesis detail resource by ID.",
      mimeType: "text/markdown",
    },
    async (uri, variables) => {
      const idValue = variables.id;
      const id = Array.isArray(idValue) ? idValue[0] : idValue;
      if (!id) {
        return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: "# Missing hypothesis ID" }] };
      }
      const res = await api<HypothesisDetailResponse>(`/api/hypotheses/${encodeURIComponent(id)}`);
      if (!res.ok) {
        return { contents: [{ uri: uri.href, mimeType: "text/markdown", text: res.result.content.map((c) => (c.type === "text" ? c.text : "")).join("\n") }] };
      }
      const h = res.data.data;
      return {
        contents: [
          {
            uri: uri.href,
            mimeType: "text/markdown",
            text: `# ${h.statement}\n\n${idLink(siteUrl, "hypothesis", h.id)}\n\n${h.rationale}\n\nStatus: ${h.status}; phase: ${h.phase}; domain: ${domainsText(h.domain)}.`,
          },
        ],
      };
    },
  );
}
