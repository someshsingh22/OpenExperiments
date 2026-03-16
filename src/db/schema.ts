import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/sqlite-core";

// -- Phase B tables (defined now for FK references) --

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  googleId: text("google_id").unique(),
  email: text("email").unique(),
  name: text("name"),
  avatarUrl: text("avatar_url"),
  passwordHash: text("password_hash"),
  affiliation: text("affiliation"),
  position: text("position"),
  scholarUrl: text("scholar_url"),
  website: text("website"),
  bio: text("bio"),
  orcid: text("orcid"),
  twitterHandle: text("twitter_handle"),
  profileCompleted: integer("profile_completed").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_sessions_user_id").on(table.userId),
    index("idx_sessions_expires_at").on(table.expiresAt),
  ],
);

// -- Phase A tables --

export const hypotheses = sqliteTable(
  "hypotheses",
  {
    id: text("id").primaryKey(),
    statement: text("statement").notNull(),
    rationale: text("rationale").notNull(),
    source: text("source").notNull(), // "human" | "ai_agent"
    agentName: text("agent_name"),
    domains: text("domains", { mode: "json" }).notNull().$type<string[]>(),
    problemStatement: text("problem_statement").notNull(),
    status: text("status").notNull(), // "proposed" | "arena_ranked" | "data_tested" | "field_validated"
    phase: text("phase").notNull(), // "live" | "completed"
    submittedAt: integer("submitted_at").notNull(),
    submittedBy: text("submitted_by").references(() => users.id),
    arenaElo: integer("arena_elo"),
    evidenceScore: integer("evidence_score"),
    pValue: real("p_value"),
    effectSize: real("effect_size"),
    isAnonymous: integer("is_anonymous").notNull().default(0),
    winRate: integer("win_rate"),
    arenaWins: integer("arena_wins").default(0),
    arenaTotal: integer("arena_total").default(0),
    commentCount: integer("comment_count").notNull().default(0),
    citationDois: text("citation_dois", { mode: "json" }).notNull().$type<string[]>(),
    relatedHypothesisIds: text("related_hypothesis_ids", { mode: "json" })
      .notNull()
      .$type<string[]>(),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_hypotheses_status").on(table.status),
    index("idx_hypotheses_phase").on(table.phase),
    index("idx_hypotheses_submitted_at").on(table.submittedAt),
    index("idx_hypotheses_arena_elo").on(table.arenaElo),
  ],
);

export const problemStatements = sqliteTable(
  "problem_statements",
  {
    id: text("id").primaryKey(),
    question: text("question").notNull(),
    description: text("description").notNull(),
    domain: text("domain").notNull(), // "persuasion" | "memorability"
    hypothesisCount: integer("hypothesis_count").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_problem_statements_domain").on(table.domain),
    uniqueIndex("idx_problem_statements_question").on(table.question),
  ],
);

export const datasets = sqliteTable(
  "datasets",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    huggingfaceUrl: text("huggingface_url").notNull(),
    taskDescription: text("task_description").notNull(),
    dataColumnNames: text("data_column_names", { mode: "json" }).notNull().$type<string[]>(),
    targetColumnName: text("target_column_name").notNull(),
    description: text("description"),
    domain: text("domain"), // nullable — "persuasion" | "memorability"
    submittedBy: text("submitted_by").references(() => users.id),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_datasets_domain").on(table.domain),
    index("idx_datasets_submitted_by").on(table.submittedBy),
  ],
);

export const datasetProblemStatements = sqliteTable(
  "dataset_problem_statements",
  {
    datasetId: text("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    problemStatementId: text("problem_statement_id")
      .notNull()
      .references(() => problemStatements.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.datasetId, table.problemStatementId] }),
    index("idx_dps_dataset_id").on(table.datasetId),
    index("idx_dps_ps_id").on(table.problemStatementId),
  ],
);

export const experiments = sqliteTable(
  "experiments",
  {
    id: text("id").primaryKey(),
    hypothesisId: text("hypothesis_id")
      .notNull()
      .references(() => hypotheses.id),
    problemStatementId: text("problem_statement_id"),
    type: text("type").notNull(), // "observational" | "survey" | "ab_test" | "pre_registered"
    status: text("status").notNull(), // "running" | "completed" | "planned"
    datasetId: text("dataset_id").references(() => datasets.id),
    datasetName: text("dataset_name").notNull(),
    methodology: text("methodology"),
    analysisPlan: text("analysis_plan"),
    startedAt: integer("started_at").notNull(),
    completedAt: integer("completed_at"),
    osfLink: text("osf_link"),
    submittedBy: text("submitted_by").references(() => users.id),
    version: integer("version").notNull().default(1),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_experiments_hypothesis_id").on(table.hypothesisId),
    index("idx_experiments_status").on(table.status),
    index("idx_experiments_dataset_id").on(table.datasetId),
  ],
);

export const experimentVersions = sqliteTable(
  "experiment_versions",
  {
    id: text("id").primaryKey(),
    experimentId: text("experiment_id")
      .notNull()
      .references(() => experiments.id),
    version: integer("version").notNull(),
    status: text("status").notNull(),
    methodology: text("methodology"),
    analysisPlan: text("analysis_plan"),
    osfLink: text("osf_link"),
    pValue: real("p_value"),
    effectSize: real("effect_size"),
    sampleSize: integer("sample_size"),
    confidenceIntervalLow: real("confidence_interval_low"),
    confidenceIntervalHigh: real("confidence_interval_high"),
    summary: text("summary"),
    changeSummary: text("change_summary"),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_exp_versions_experiment_id").on(table.experimentId),
    uniqueIndex("idx_exp_versions_exp_version").on(table.experimentId, table.version),
  ],
);

export const experimentResults = sqliteTable("experiment_results", {
  experimentId: text("experiment_id")
    .primaryKey()
    .references(() => experiments.id),
  pValue: real("p_value").notNull(),
  effectSize: real("effect_size").notNull(),
  confidenceIntervalLow: real("confidence_interval_low").notNull(),
  confidenceIntervalHigh: real("confidence_interval_high").notNull(),
  sampleSize: integer("sample_size").notNull(),
  summary: text("summary").notNull(),
  uplift: text("uplift"),
  createdAt: integer("created_at").notNull(),
});

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    hypothesisId: text("hypothesis_id")
      .notNull()
      .references(() => hypotheses.id),
    userId: text("user_id").references(() => users.id),
    body: text("body").notNull(),
    doi: text("doi"),
    parentId: text("parent_id"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("idx_comments_hypothesis_id").on(table.hypothesisId),
    index("idx_comments_user_id").on(table.userId),
    index("idx_comments_parent_id").on(table.parentId),
  ],
);

export const arenaMatchups = sqliteTable("arena_matchups", {
  id: text("id").primaryKey(),
  hypothesisAId: text("hypothesis_a_id")
    .notNull()
    .references(() => hypotheses.id),
  hypothesisBId: text("hypothesis_b_id")
    .notNull()
    .references(() => hypotheses.id),
  totalVotes: integer("total_votes").notNull().default(0),
  votesA: integer("votes_a").notNull().default(0),
  votesB: integer("votes_b").notNull().default(0),
  votesTie: integer("votes_tie").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const arenaVotes = sqliteTable(
  "arena_votes",
  {
    id: text("id").primaryKey(),
    matchupId: text("matchup_id")
      .notNull()
      .references(() => arenaMatchups.id),
    userId: text("user_id").references(() => users.id), // nullable for anonymous
    voterIpHash: text("voter_ip_hash"), // hashed IP for anonymous dedup
    vote: text("vote").notNull(), // "a" | "b" | "tie" | "both_weak"
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    index("idx_arena_votes_matchup_id").on(table.matchupId),
    uniqueIndex("idx_arena_votes_ip_matchup").on(table.matchupId, table.voterIpHash),
  ],
);

export const stars = sqliteTable(
  "stars",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    hypothesisId: text("hypothesis_id")
      .notNull()
      .references(() => hypotheses.id),
    createdAt: integer("created_at").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.hypothesisId] }),
    index("idx_stars_user_id").on(table.userId),
    index("idx_stars_hypothesis_id").on(table.hypothesisId),
  ],
);
