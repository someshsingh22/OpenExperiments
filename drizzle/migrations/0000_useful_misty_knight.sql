CREATE TABLE `arena_matchups` (
	`id` text PRIMARY KEY NOT NULL,
	`hypothesis_a_id` text NOT NULL,
	`hypothesis_b_id` text NOT NULL,
	`total_votes` integer DEFAULT 0 NOT NULL,
	`votes_a` integer DEFAULT 0 NOT NULL,
	`votes_b` integer DEFAULT 0 NOT NULL,
	`votes_tie` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`hypothesis_a_id`) REFERENCES `hypotheses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hypothesis_b_id`) REFERENCES `hypotheses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `arena_votes` (
	`id` text PRIMARY KEY NOT NULL,
	`matchup_id` text NOT NULL,
	`user_id` text,
	`voter_ip_hash` text,
	`vote` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`matchup_id`) REFERENCES `arena_matchups`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_arena_votes_matchup_id` ON `arena_votes` (`matchup_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_arena_votes_ip_matchup` ON `arena_votes` (`matchup_id`,`voter_ip_hash`);--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`hypothesis_id` text NOT NULL,
	`user_id` text,
	`body` text NOT NULL,
	`doi` text,
	`parent_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`hypothesis_id`) REFERENCES `hypotheses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_comments_hypothesis_id` ON `comments` (`hypothesis_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_user_id` ON `comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_parent_id` ON `comments` (`parent_id`);--> statement-breakpoint
CREATE TABLE `dataset_problem_statements` (
	`dataset_id` text NOT NULL,
	`problem_statement_id` text NOT NULL,
	PRIMARY KEY(`dataset_id`, `problem_statement_id`),
	FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_statement_id`) REFERENCES `problem_statements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_dps_dataset_id` ON `dataset_problem_statements` (`dataset_id`);--> statement-breakpoint
CREATE INDEX `idx_dps_ps_id` ON `dataset_problem_statements` (`problem_statement_id`);--> statement-breakpoint
CREATE TABLE `datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`huggingface_url` text NOT NULL,
	`task_description` text NOT NULL,
	`data_column_names` text NOT NULL,
	`target_column_name` text NOT NULL,
	`description` text,
	`domain` text,
	`submitted_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_datasets_domain` ON `datasets` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_datasets_submitted_by` ON `datasets` (`submitted_by`);--> statement-breakpoint
CREATE TABLE `experiment_results` (
	`experiment_id` text PRIMARY KEY NOT NULL,
	`p_value` real NOT NULL,
	`effect_size` real NOT NULL,
	`confidence_interval_low` real NOT NULL,
	`confidence_interval_high` real NOT NULL,
	`sample_size` integer NOT NULL,
	`summary` text NOT NULL,
	`uplift` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`experiment_id`) REFERENCES `experiments`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `experiments` (
	`id` text PRIMARY KEY NOT NULL,
	`hypothesis_id` text NOT NULL,
	`problem_statement_id` text,
	`type` text NOT NULL,
	`status` text NOT NULL,
	`dataset_id` text,
	`dataset_name` text NOT NULL,
	`methodology` text NOT NULL,
	`analysis_plan` text,
	`started_at` integer NOT NULL,
	`completed_at` integer,
	`osf_link` text,
	`submitted_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`hypothesis_id`) REFERENCES `hypotheses`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dataset_id`) REFERENCES `datasets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_experiments_hypothesis_id` ON `experiments` (`hypothesis_id`);--> statement-breakpoint
CREATE INDEX `idx_experiments_status` ON `experiments` (`status`);--> statement-breakpoint
CREATE INDEX `idx_experiments_dataset_id` ON `experiments` (`dataset_id`);--> statement-breakpoint
CREATE TABLE `hypotheses` (
	`id` text PRIMARY KEY NOT NULL,
	`statement` text NOT NULL,
	`rationale` text NOT NULL,
	`source` text NOT NULL,
	`agent_name` text,
	`domains` text NOT NULL,
	`problem_statement` text NOT NULL,
	`status` text NOT NULL,
	`phase` text NOT NULL,
	`submitted_at` integer NOT NULL,
	`submitted_by` text,
	`arena_elo` integer,
	`evidence_score` integer,
	`p_value` real,
	`effect_size` real,
	`is_anonymous` integer DEFAULT 0 NOT NULL,
	`comment_count` integer DEFAULT 0 NOT NULL,
	`citation_dois` text NOT NULL,
	`related_hypothesis_ids` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_hypotheses_status` ON `hypotheses` (`status`);--> statement-breakpoint
CREATE INDEX `idx_hypotheses_phase` ON `hypotheses` (`phase`);--> statement-breakpoint
CREATE INDEX `idx_hypotheses_submitted_at` ON `hypotheses` (`submitted_at`);--> statement-breakpoint
CREATE INDEX `idx_hypotheses_arena_elo` ON `hypotheses` (`arena_elo`);--> statement-breakpoint
CREATE TABLE `problem_statements` (
	`id` text PRIMARY KEY NOT NULL,
	`question` text NOT NULL,
	`description` text NOT NULL,
	`domain` text NOT NULL,
	`hypothesis_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_problem_statements_domain` ON `problem_statements` (`domain`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_user_id` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_sessions_expires_at` ON `sessions` (`expires_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`google_id` text,
	`email` text,
	`name` text,
	`avatar_url` text,
	`password_hash` text,
	`affiliation` text,
	`scholar_url` text,
	`website` text,
	`bio` text,
	`orcid` text,
	`twitter_handle` text,
	`profile_completed` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_google_id_unique` ON `users` (`google_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);