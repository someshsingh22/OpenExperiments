CREATE TABLE `mcp_auth_codes` (
	`code_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_mcp_auth_codes_expires_at` ON `mcp_auth_codes` (`expires_at`);--> statement-breakpoint
CREATE TABLE `mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`user_id` text NOT NULL,
	`label` text,
	`source` text NOT NULL,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	`last_used_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_mcp_tokens_token_hash` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_mcp_tokens_user_id` ON `mcp_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_mcp_tokens_expires_at` ON `mcp_tokens` (`expires_at`);