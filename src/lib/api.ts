import type {
  Hypothesis,
  Experiment,
  ExperimentVersion,
  Comment,
  ProblemStatement,
  Dataset,
} from "./types";

const BASE = "";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(`${BASE}${url}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// Hypotheses
export async function getHypotheses(params?: {
  domain?: string;
  phase?: string;
  status?: string;
  sort?: string;
  search?: string;
  limit?: number;
  offset?: number;
  ids?: string;
}): Promise<{ data: Hypothesis[]; total: number }> {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") query.set(k, String(v));
    });
  }
  const qs = query.toString();
  return fetchJSON(`/api/hypotheses${qs ? `?${qs}` : ""}`);
}

export async function getHypothesis(id: string): Promise<{
  data: Hypothesis;
  experiments: Experiment[];
  comments: Comment[];
}> {
  return fetchJSON(`/api/hypotheses/${id}`);
}

export async function submitHypothesis(data: {
  statement: string;
  rationale: string;
  problemStatement: string;
  domains: string[];
  source: string;
  agentName?: string;
  citationDois?: string[];
  isAnonymous?: boolean;
}): Promise<{ data: { id: string } }> {
  const res = await fetch(`${BASE}/api/hypotheses`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const parsed = err as { error?: string; errors?: { field: string; message: string }[] };
    if (parsed.errors?.length) {
      throw new Error(parsed.errors.map((e) => e.message).join(". "));
    }
    throw new Error(parsed.error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function addCitation(
  hypothesisId: string,
  citation: string,
): Promise<{ data: { citationDois: string[] } }> {
  const res = await fetch(`${BASE}/api/hypotheses/${hypothesisId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ addCitation: citation }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
  }
  return res.json();
}

// Comments (write)
export async function postComment(data: {
  hypothesisId: string;
  content: string;
  doi?: string;
  parentId?: string;
}): Promise<{
  data: Comment & { author: { id: string; name: string | null; avatarUrl: string | null } };
}> {
  const res = await fetch(`${BASE}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
  }
  return res.json();
}

// Experiments
export async function getExperiments(hypothesisId?: string): Promise<{ data: Experiment[] }> {
  const qs = hypothesisId ? `?hypothesisId=${hypothesisId}` : "";
  return fetchJSON(`/api/experiments${qs}`);
}

export async function getExperiment(
  id: string,
  version?: number,
): Promise<{
  data: Experiment;
  hypothesis: {
    id: string;
    statement: string;
    status: string;
    phase: string;
    domains: string[];
  } | null;
  versions?: ExperimentVersion[];
}> {
  const qs = version ? `?version=${version}` : "";
  return fetchJSON(`/api/experiments/${id}${qs}`);
}

// Problem Statements
export async function getProblemStatements(params?: {
  includeDatasets?: boolean;
}): Promise<{ data: ProblemStatement[] }> {
  const qs = params?.includeDatasets ? "?includeDatasets=true" : "";
  return fetchJSON(`/api/problem-statements${qs}`);
}

// Datasets
export async function getDatasets(params?: { domain?: string }): Promise<{ data: Dataset[] }> {
  const query = new URLSearchParams();
  if (params?.domain) query.set("domain", params.domain);
  const qs = query.toString();
  return fetchJSON(`/api/datasets${qs ? `?${qs}` : ""}`);
}

export async function getDataset(id: string): Promise<{
  data: Dataset;
  problemStatements: Array<{
    id: string;
    question: string;
    domain: string;
    hypothesisCount: number;
  }>;
  experiments: Array<{
    id: string;
    hypothesisId: string;
    type: string;
    status: string;
    methodology: string;
    startedAt: string;
  }>;
}> {
  return fetchJSON(`/api/datasets/${id}`);
}

// Submit Experiment
export async function submitExperiment(data: {
  hypothesisId: string;
  problemStatementId?: string;
  type: string;
  datasetId?: string;
  datasetName?: string;
  status?: string;
  methodology?: string;
  analysisPlan?: string;
  osfLink?: string;
  results?: {
    pValue?: number;
    effectSize?: number;
    sampleSize?: number;
    confidenceIntervalLow?: number;
    confidenceIntervalHigh?: number;
    summary?: string;
  };
}): Promise<{ data: { id: string } }> {
  const res = await fetch(`${BASE}/api/experiments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
  }
  return res.json();
}

// Update Experiment
export async function updateExperiment(
  id: string,
  data: {
    status?: string;
    methodology?: string;
    analysisPlan?: string;
    osfLink?: string;
    results?: {
      pValue?: number;
      effectSize?: number;
      sampleSize?: number;
      confidenceIntervalLow?: number;
      confidenceIntervalHigh?: number;
      summary?: string;
    };
    changeSummary?: string;
  },
): Promise<{ data: { id: string; version: number } }> {
  const res = await fetch(`${BASE}/api/experiments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
  }
  return res.json();
}

// Comments
export async function getComments(hypothesisId: string): Promise<{ data: Comment[] }> {
  return fetchJSON(`/api/comments?hypothesisId=${hypothesisId}`);
}

// Arena
export async function getMatchup(): Promise<{
  data: {
    id: string;
    totalVotes: number;
    votesA: number;
    votesB: number;
    votesTie: number;
    hypothesisA: { id: string; statement: string; domain: string[]; arenaElo: number | null };
    hypothesisB: { id: string; statement: string; domain: string[]; arenaElo: number | null };
  };
}> {
  return fetchJSON("/api/arena/matchup");
}

export async function getArenaRankings(): Promise<{
  data: { id: string; statement: string; domain: string[]; winRate: number }[];
}> {
  return fetchJSON("/api/arena/rankings");
}

export async function castVote(
  matchupId: string,
  vote: "a" | "b" | "tie" | "both_weak",
): Promise<{
  data: { id: string; totalVotes: number; votesA: number; votesB: number; votesTie: number };
}> {
  const res = await fetch(`${BASE}/api/arena/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ matchupId, vote }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
  }
  return res.json();
}

// Stars
export async function toggleStar(
  hypothesisId: string,
): Promise<{ data: { count: number; starred: boolean } }> {
  const res = await fetch(`${BASE}/api/hypotheses/${hypothesisId}/star`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || `API error: ${res.status}`);
  }
  return res.json();
}

export async function getStarStatus(
  hypothesisId: string,
): Promise<{ data: { count: number; starred: boolean } }> {
  return fetchJSON(`/api/hypotheses/${hypothesisId}/star`);
}

export async function getStarsBatch(
  ids: string[],
): Promise<{ data: Record<string, { count: number; starred: boolean }> }> {
  if (ids.length === 0) return { data: {} };
  return fetchJSON(`/api/hypotheses/stars?ids=${ids.join(",")}`);
}

// Profile update
export async function updateProfile(
  userId: string,
  data: {
    name?: string;
    position?: string;
    scholarUrl?: string;
    website?: string;
    bio?: string;
    orcid?: string;
    twitterHandle?: string;
  },
): Promise<{ ok: boolean }> {
  const res = await fetch(`${BASE}/api/users/${userId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const parsed = err as { error?: string; errors?: { field: string; message: string }[] };
    if (parsed.errors?.length) {
      throw new Error(parsed.errors.map((e) => e.message).join(". "));
    }
    throw new Error(parsed.error || `API error: ${res.status}`);
  }
  return res.json();
}
