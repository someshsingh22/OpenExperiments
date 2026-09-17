-- Dataset OSF-style scientific characterization.
--
-- Reframes a dataset from an ML benchmark into a research instrument:
--   * legacy ML-benchmark columns (task_description, data_column_names,
--     target_column_name) become nullable — new submissions no longer use them;
--   * adds osf_characterization (JSON blob of the OSF-style prose answers) plus
--     three promoted, indexed columns (license, foreknowledge_status,
--     unit_of_analysis).
--
-- Rebuild pattern (SQLite can't drop NOT NULL in place). datasets is referenced
-- by dataset_problem_statements and experiments via string FKs; foreign_keys is
-- disabled during the swap so those references survive the drop/rename.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_datasets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`huggingface_url` text NOT NULL,
	`task_description` text,
	`data_column_names` text,
	`target_column_name` text,
	`description` text,
	`domain` text,
	`osf_characterization` text,
	`license` text,
	`foreknowledge_status` text,
	`unit_of_analysis` text,
	`submitted_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`submitted_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_datasets`("id", "name", "huggingface_url", "task_description", "data_column_names", "target_column_name", "description", "domain", "osf_characterization", "license", "foreknowledge_status", "unit_of_analysis", "submitted_by", "created_at", "updated_at") SELECT "id", "name", "huggingface_url", "task_description", "data_column_names", "target_column_name", "description", "domain", NULL, NULL, NULL, NULL, "submitted_by", "created_at", "updated_at" FROM `datasets`;--> statement-breakpoint
DROP TABLE `datasets`;--> statement-breakpoint
ALTER TABLE `__new_datasets` RENAME TO `datasets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_datasets_domain` ON `datasets` (`domain`);--> statement-breakpoint
CREATE INDEX `idx_datasets_submitted_by` ON `datasets` (`submitted_by`);--> statement-breakpoint
CREATE INDEX `idx_datasets_license` ON `datasets` (`license`);--> statement-breakpoint
CREATE INDEX `idx_datasets_foreknowledge` ON `datasets` (`foreknowledge_status`);
