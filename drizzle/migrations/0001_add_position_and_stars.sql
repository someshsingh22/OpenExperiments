ALTER TABLE `users` ADD COLUMN `position` text;
--> statement-breakpoint
CREATE TABLE `stars` (
	`user_id` text NOT NULL,
	`hypothesis_id` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `hypothesis_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`hypothesis_id`) REFERENCES `hypotheses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_stars_user_id` ON `stars` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_stars_hypothesis_id` ON `stars` (`hypothesis_id`);
