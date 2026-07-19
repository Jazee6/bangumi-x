CREATE TABLE `credential_management_attempt` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `credentialManagementAttempt_sessionId_idx` ON `credential_management_attempt` (`session_id`);--> statement-breakpoint
CREATE TABLE `credential_management_grant` (
	`session_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`authorized_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mini_binding_challenge` (
	`id` text PRIMARY KEY NOT NULL,
	`secret_hash` text NOT NULL,
	`target_user_id` text NOT NULL,
	`web_session_id` text NOT NULL,
	`inspector_user_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`expires_at` integer NOT NULL,
	`resolved_at` integer,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	FOREIGN KEY (`target_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`web_session_id`) REFERENCES `session`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`inspector_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mini_binding_challenge_secret_hash_unique` ON `mini_binding_challenge` (`secret_hash`);--> statement-breakpoint
CREATE INDEX `miniBindingChallenge_targetUserId_status_idx` ON `mini_binding_challenge` (`target_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `miniBindingChallenge_webSessionId_idx` ON `mini_binding_challenge` (`web_session_id`);