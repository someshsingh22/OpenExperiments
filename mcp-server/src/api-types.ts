export type HypothesisStatus = "proposed" | "arena_ranked" | "data_tested" | "field_validated";
export type Phase = "live" | "completed";
export type Source = "human" | "ai_agent";
export type ExperimentType = "observational" | "survey" | "ab_test" | "pre_registered";
export type ExperimentStatus = "planned" | "running" | "completed";
export type ArenaVote = "a" | "b" | "tie" | "both_weak";

export interface ApiList<T> {
  data: T[];
  total?: number;
}

export interface ApiData<T> {
  data: T;
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error?: string;
  errors?: FieldError[];
}

export interface UserSummary {
  id: string;
  name: string | null;
  avatarUrl: string | null;
}

export interface AuthMeResponse {
  user: (UserSummary & { email: string | null; profileCompleted?: boolean }) | null;
}

export interface Hypothesis {
  id: string;
  statement: string;
  rationale: string;
  source: Source;
  agentName?: string | null;
  domain: string[];
  problemStatement: string;
  status: HypothesisStatus;
  phase: Phase;
  submittedAt: string;
  arenaElo?: number | null;
  evidenceScore?: number | null;
  pValue?: number | null;
  effectSize?: number | null;
  isAnonymous?: boolean;
  submittedBy?: string | null;
  winRate?: number | null;
  commentCount: number;
  experimentCount?: number;
  citationDois: string[];
  relatedHypothesisIds: string[];
}

export interface Comment {
  id: string;
  hypothesisId: string;
  body: string;
  doi?: string | null;
  createdAt: string;
  parentId?: string | null;
  author?: UserSummary | null;
}

export interface ExperimentResult {
  pValue?: number;
  effectSize?: number;
  confidenceInterval?: [number, number];
  sampleSize?: number;
  summary?: string;
  uplift?: string;
}

export interface Experiment {
  id: string;
  hypothesisId: string;
  problemStatementId?: string | null;
  type: ExperimentType;
  status: ExperimentStatus;
  datasetId?: string | null;
  datasetName: string;
  methodology?: string | null;
  analysisPlan?: string | null;
  results?: ExperimentResult;
  submitter?: UserSummary | null;
  startedAt: string;
  completedAt?: string;
  osfLink?: string | null;
  version: number;
  totalVersions?: number;
}

export interface ExperimentVersion {
  version: number;
  status: string;
  methodology?: string | null;
  analysisPlan?: string | null;
  osfLink?: string | null;
  results?: Partial<ExperimentResult>;
  changeSummary?: string | null;
  createdAt: string;
}

export interface ProblemStatement {
  id: string;
  question: string;
  description: string;
  domain: string;
  hypothesisCount: number;
  datasets?: Array<{ id: string; name: string; huggingfaceUrl: string | null }>;
}

export interface OsfCharacterization {
  provenance: string;
  foreknowledgeExplanation?: string;
  collectionProcedure: string;
  startStopRules?: string;
  variables: string;
  inclusionExclusion: string;
  missingData: string;
  limitations?: string;
  tags: string[];
}

export interface Dataset {
  id: string;
  name: string;
  huggingfaceUrl: string | null;
  taskDescription?: string | null;
  dataColumnNames?: string[] | null;
  targetColumnName?: string | null;
  description?: string | null;
  domain?: string | null;
  license?: string | null;
  foreknowledgeStatus?: string | null;
  unitOfAnalysis?: string | null;
  osfCharacterization?: OsfCharacterization | null;
  createdAt: string;
  problemStatementCount?: number;
  experimentCount?: number;
}

export interface HypothesisDetailResponse {
  data: Hypothesis;
  experiments: Experiment[];
  comments: Comment[];
}

export interface DatasetDetailResponse {
  data: Dataset;
  problemStatements: Array<{ id: string; question: string; domain: string; hypothesisCount: number }>;
  experiments: Array<{
    id: string;
    hypothesisId: string;
    type: string;
    status: string;
    methodology?: string | null;
    startedAt: string;
  }>;
}

export interface ExperimentDetailResponse {
  data: Experiment;
  hypothesis: { id: string; statement: string; status: string; phase: string; domains: string[] } | null;
  versions?: ExperimentVersion[];
}

export interface ArenaRanking {
  id: string;
  statement: string;
  domain: string[];
  winRate: number;
}

export interface ArenaMatchupHypothesis {
  id: string;
  statement: string;
  domain: string[];
  arenaElo?: number | null;
  source?: Source;
  agentName?: string | null;
}

export interface ArenaMatchup {
  id: string;
  totalVotes: number;
  votesA: number;
  votesB: number;
  votesTie: number;
  hypothesisA: ArenaMatchupHypothesis | null;
  hypothesisB: ArenaMatchupHypothesis | null;
}

export interface VoteResponse {
  id: string;
  totalVotes: number;
  votesA: number;
  votesB: number;
  votesTie: number;
}

export interface StarStatus {
  count: number;
  starred: boolean;
}

export interface UserProfileResponse {
  data: {
    user: {
      id: string;
      name: string | null;
      email: string | null;
      avatarUrl: string | null;
      affiliation: string | null;
      position: string | null;
      scholarUrl: string | null;
      website: string | null;
      bio: string | null;
      orcid: string | null;
      twitterHandle: string | null;
      joinedAt: string;
    };
    hypotheses: Array<{
      id: string;
      statement: string;
      status: HypothesisStatus;
      phase: Phase;
      domain: string[];
      isAnonymous: boolean;
      submittedAt: string;
    }>;
    starredHypotheses: Array<{
      id: string;
      statement: string;
      status: HypothesisStatus;
      phase: Phase;
      domain: string[];
      submittedAt: string;
    }>;
    stats: { hypothesisCount: number; experimentCount: number; commentCount: number; voteCount: number };
    isOwner: boolean;
  };
}
