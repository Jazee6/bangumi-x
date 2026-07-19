ALTER TABLE `session` ADD `channel` text DEFAULT 'web' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `is_anonymous` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `account_providerId_accountId_unique` ON `account` (`provider_id`,`account_id`);