export type HypothesisStatus = "proposed" | "arena_ranked" | "data_tested" | "field_validated";
export type Phase = "live" | "completed";
export type Source = "human" | "ai_agent";
export type Domain = "persuasion" | "memorability";

export interface Hypothesis {
  id: string;
  statement: string;
  rationale: string;
  source: Source;
  agentName?: string;
  domain: Domain[];
  problemStatement: string;
  status: HypothesisStatus;
  phase: Phase;
  submittedAt: string;
  arenaElo?: number;
  evidenceScore?: number;
  pValue?: number;
  effectSize?: number;
  isAnonymous?: boolean;
  submittedBy?: string | null;
  winRate?: number | null;
  commentCount: number;
  experimentCount?: number;
  citationDois: string[];
  relatedHypothesisIds: string[];
}

export interface ArenaMatchup {
  id: string;
  hypothesisA: string;
  hypothesisB: string;
  totalVotes: number;
  votesA: number;
  votesB: number;
  votesTie: number;
}

export interface Experiment {
  id: string;
  hypothesisId: string;
  problemStatementId?: string;
  type: "observational" | "survey" | "ab_test" | "pre_registered";
  status: "running" | "completed" | "planned";
  datasetId?: string;
  datasetName: string;
  methodology?: string;
  analysisPlan?: string;
  results?: ExperimentResult;
  submitter?: { id: string; name: string | null; avatarUrl: string | null } | null;
  startedAt: string;
  completedAt?: string;
  osfLink?: string;
  version: number;
  totalVersions?: number;
}

export interface ExperimentResult {
  pValue?: number;
  effectSize?: number;
  confidenceInterval?: [number, number];
  sampleSize?: number;
  summary?: string;
  uplift?: string;
}

export interface ExperimentVersion {
  version: number;
  status: string;
  methodology?: string;
  analysisPlan?: string;
  osfLink?: string;
  results?: Partial<ExperimentResult>;
  changeSummary?: string;
  createdAt: string;
}

export interface ProblemStatement {
  id: string;
  question: string;
  description: string;
  domain: Domain;
  hypothesisCount: number;
  datasets?: Array<{ id: string; name: string; huggingfaceUrl: string }>;
}

export interface Dataset {
  id: string;
  name: string;
  huggingfaceUrl: string;
  taskDescription: string;
  dataColumnNames: string[];
  targetColumnName: string;
  description?: string;
  domain?: Domain;
  createdAt: string;
  problemStatementCount?: number;
  experimentCount?: number;
}

export interface Comment {
  id: string;
  hypothesisId: string;
  body: string;
  doi?: string;
  createdAt: string;
  parentId?: string;
}
