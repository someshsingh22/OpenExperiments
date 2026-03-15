ALTER TABLE experiments ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
--> statement-breakpoint
CREATE TABLE experiment_versions (
  id TEXT PRIMARY KEY,
  experiment_id TEXT NOT NULL REFERENCES experiments(id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  methodology TEXT,
  analysis_plan TEXT,
  osf_link TEXT,
  p_value REAL,
  effect_size REAL,
  sample_size INTEGER,
  confidence_interval_low REAL,
  confidence_interval_high REAL,
  summary TEXT,
  change_summary TEXT,
  created_at INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX idx_exp_versions_experiment_id ON experiment_versions(experiment_id);
--> statement-breakpoint
CREATE UNIQUE INDEX idx_exp_versions_exp_version ON experiment_versions(experiment_id, version);
