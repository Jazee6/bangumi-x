CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`issuer` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_issuer_account_unique` ON `account` (`issuer`,`account_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_wechat_user_unique` ON `account` (`user_id`) WHERE "account"."provider_id" = 'wechat-mini';--> statement-breakpoint
CREATE INDEX `account_provider_id_idx` ON `account` (`provider_id`);--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `broadcast_snapshot` (
	`subject_id` integer PRIMARY KEY NOT NULL,
	`chapters` text NOT NULL,
	`complete_after` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `broadcast_snapshot_updated_at_idx` ON `broadcast_snapshot` (`updated_at`);--> statement-breakpoint
CREATE TABLE `collection` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject_id` integer NOT NULL,
	`collected_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subject_snapshot`(`subject_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_user_subject_unique` ON `collection` (`user_id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `collection_user_collected_subject_idx` ON `collection` (`user_id`,`collected_at`,`subject_id`);--> statement-breakpoint
CREATE INDEX `collection_subject_id_idx` ON `collection` (`subject_id`);--> statement-breakpoint
CREATE TABLE `collection_list` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`is_public` integer DEFAULT false NOT NULL,
	`share_token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "collection_list_name_length_check" CHECK(length("collection_list"."name") between 1 and 50)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_list_user_name_unique` ON `collection_list` (`user_id`,`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `collection_list_share_token_unique` ON `collection_list` (`share_token`);--> statement-breakpoint
CREATE INDEX `collection_list_user_created_id_idx` ON `collection_list` (`user_id`,`created_at`,`id`);--> statement-breakpoint
CREATE TABLE `collection_list_member` (
	`id` text PRIMARY KEY NOT NULL,
	`list_id` text NOT NULL,
	`subject_id` integer NOT NULL,
	`added_at` integer NOT NULL,
	FOREIGN KEY (`list_id`) REFERENCES `collection_list`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subject_snapshot`(`subject_id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `collection_list_member_list_subject_unique` ON `collection_list_member` (`list_id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `collection_list_member_list_added_subject_idx` ON `collection_list_member` (`list_id`,`added_at`,`subject_id`);--> statement-breakpoint
CREATE INDEX `collection_list_member_subject_id_idx` ON `collection_list_member` (`subject_id`);--> statement-breakpoint
CREATE TABLE `directory_sync_state` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `mini_account_link_request` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`short_code_hash` text NOT NULL,
	`claim_token_hash` text,
	`source_user_id` text,
	`target_user_id` text NOT NULL,
	`status` text NOT NULL,
	`preview_version` text,
	`result_session_token` text,
	`error_code` text,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mini_account_link_short_code_unique` ON `mini_account_link_request` (`short_code_hash`);--> statement-breakpoint
CREATE UNIQUE INDEX `mini_account_link_claim_token_unique` ON `mini_account_link_request` (`claim_token_hash`);--> statement-breakpoint
CREATE INDEX `mini_account_link_target_status_idx` ON `mini_account_link_request` (`target_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `mini_account_link_source_status_idx` ON `mini_account_link_request` (`source_user_id`,`status`);--> statement-breakpoint
CREATE INDEX `mini_account_link_expires_idx` ON `mini_account_link_request` (`expires_at`);--> statement-breakpoint
CREATE TABLE `mini_profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`avatar_key` text,
	`pending_avatar_key` text,
	`pending_avatar_trace_id` text,
	`pending_avatar_expires_at` integer,
	`mutation_day` text,
	`mutation_count` integer DEFAULT 0 NOT NULL,
	`link_claim_window_started_at` integer,
	`link_claim_failure_count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mini_profile_pending_trace_unique` ON `mini_profile` (`pending_avatar_trace_id`);--> statement-breakpoint
CREATE TABLE `progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject_id` integer NOT NULL,
	`stage` text NOT NULL,
	`completed_chapters` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subject_snapshot`(`subject_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "progress_stage_check" CHECK("progress"."stage" in ('in_progress', 'completed')),
	CONSTRAINT "progress_completed_chapters_non_negative" CHECK("progress"."completed_chapters" is null or "progress"."completed_chapters" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `progress_user_subject_unique` ON `progress` (`user_id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `progress_user_stage_updated_subject_idx` ON `progress` (`user_id`,`stage`,`updated_at`,`subject_id`);--> statement-breakpoint
CREATE INDEX `progress_user_updated_subject_idx` ON `progress` (`user_id`,`updated_at`,`subject_id`);--> statement-breakpoint
CREATE INDEX `progress_subject_id_idx` ON `progress` (`subject_id`);--> statement-breakpoint
CREATE TABLE `public_entity_directory` (
	`id` text PRIMARY KEY NOT NULL,
	`resource_type` text NOT NULL,
	`external_id` text NOT NULL,
	`discovery_source` text NOT NULL,
	`first_discovered_at` integer NOT NULL,
	`last_verified_at` integer,
	`index_status` text NOT NULL,
	`index_reason` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `public_entity_directory_resource_external_unique` ON `public_entity_directory` (`resource_type`,`external_id`);--> statement-breakpoint
CREATE INDEX `public_entity_directory_resource_status_verified_idx` ON `public_entity_directory` (`resource_type`,`index_status`,`last_verified_at`);--> statement-breakpoint
CREATE INDEX `public_entity_directory_resource_status_external_idx` ON `public_entity_directory` (`resource_type`,`index_status`,`external_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `subject_snapshot` (
	`id` text PRIMARY KEY NOT NULL,
	`subject_id` integer NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`poster_source_url` text,
	`nsfw` integer NOT NULL,
	`total_chapters` integer,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `subject_snapshot_subject_id_unique` ON `subject_snapshot` (`subject_id`);--> statement-breakpoint
CREATE INDEX `subject_snapshot_updated_at_idx` ON `subject_snapshot` (`updated_at`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer NOT NULL,
	`image` text,
	`is_anonymous` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_merge_audit` (
	`id` text PRIMARY KEY NOT NULL,
	`source_user_id` text NOT NULL,
	`target_user_id` text NOT NULL,
	`result_type` text NOT NULL,
	`collection_count` integer NOT NULL,
	`progress_count` integer NOT NULL,
	`list_count` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `user_merge_audit_target_created_idx` ON `user_merge_audit` (`target_user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `wechat_access_token` (
	`key` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
