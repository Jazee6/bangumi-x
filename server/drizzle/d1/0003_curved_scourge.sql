DROP TABLE `credential_management_attempt`;--> statement-breakpoint
CREATE TABLE `credential_management_attempt` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`expected_account_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expected_account_id`) REFERENCES `account`(`id`) ON UPDATE no action ON DELETE cascade
);--> statement-breakpoint
CREATE INDEX `credentialManagementAttempt_sessionId_idx` ON `credential_management_attempt` (`session_id`);
