DROP INDEX `idx_experiments_hypothesis_id`;--> statement-breakpoint
CREATE INDEX `idx_experiments_hypothesis_started_at_id` ON `experiments` (`hypothesis_id`,`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_experiments_started_at_id` ON `experiments` (`started_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_experiments_submitted_by` ON `experiments` (`submitted_by`);--> statement-breakpoint
DROP INDEX `idx_hypotheses_submitted_at`;--> statement-breakpoint
CREATE INDEX `idx_hypotheses_submitted_at_id` ON `hypotheses` (`submitted_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_hypotheses_submitted_by_created_at_id` ON `hypotheses` (`submitted_by`,`created_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_hypotheses_phase_submitted_at_id` ON `hypotheses` (`phase`,`submitted_at`,`id`);--> statement-breakpoint
CREATE INDEX `idx_hypotheses_win_rate_id` ON `hypotheses` (`win_rate`,`id`);--> statement-breakpoint
CREATE INDEX `idx_hypotheses_phase_win_rate_id` ON `hypotheses` (`phase`,`win_rate`,`id`);--> statement-breakpoint
CREATE INDEX `idx_arena_votes_user_id` ON `arena_votes` (`user_id`);