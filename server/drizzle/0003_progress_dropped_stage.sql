PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_progress` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subject_id` integer NOT NULL,
	`stage` text NOT NULL,
	`completed_chapters` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subject_id`) REFERENCES `subject_snapshot`(`subject_id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "progress_stage_check" CHECK("__new_progress"."stage" in ('in_progress', 'completed', 'dropped')),
	CONSTRAINT "progress_completed_chapters_non_negative" CHECK("__new_progress"."completed_chapters" is null or "__new_progress"."completed_chapters" >= 0)
);
--> statement-breakpoint
INSERT INTO `__new_progress`("id", "user_id", "subject_id", "stage", "completed_chapters", "created_at", "updated_at") SELECT "id", "user_id", "subject_id", "stage", "completed_chapters", "created_at", "updated_at" FROM `progress`;--> statement-breakpoint
DROP TABLE `progress`;--> statement-breakpoint
ALTER TABLE `__new_progress` RENAME TO `progress`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `progress_user_subject_unique` ON `progress` (`user_id`,`subject_id`);--> statement-breakpoint
CREATE INDEX `progress_user_stage_updated_subject_idx` ON `progress` (`user_id`,`stage`,`updated_at`,`subject_id`);--> statement-breakpoint
CREATE INDEX `progress_user_updated_subject_idx` ON `progress` (`user_id`,`updated_at`,`subject_id`);--> statement-breakpoint
CREATE INDEX `progress_subject_id_idx` ON `progress` (`subject_id`);