DROP INDEX `mini_profile_pending_trace_unique`;--> statement-breakpoint
ALTER TABLE `mini_profile` DROP COLUMN `pending_avatar_key`;--> statement-breakpoint
ALTER TABLE `mini_profile` DROP COLUMN `pending_avatar_trace_id`;--> statement-breakpoint
ALTER TABLE `mini_profile` DROP COLUMN `pending_avatar_expires_at`;