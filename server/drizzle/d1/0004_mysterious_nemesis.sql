CREATE TABLE `mini_identity` (
	`user_id` text PRIMARY KEY NOT NULL,
	`last_active_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `mini_identity` (`user_id`, `last_active_at`)
SELECT DISTINCT u.`id`, u.`updated_at`
FROM `user` u
JOIN `account` a ON a.`user_id` = u.`id` AND a.`provider_id` = 'wechat-mini'
WHERE u.`is_anonymous` = 1;--> statement-breakpoint
ALTER TABLE `mini_binding_challenge` ADD `conflict_reason` text;--> statement-breakpoint
ALTER TABLE `mini_binding_challenge` ADD `merge_nonce` text;--> statement-breakpoint
CREATE UNIQUE INDEX `mini_binding_challenge_merge_nonce_unique` ON `mini_binding_challenge` (`merge_nonce`);--> statement-breakpoint
CREATE UNIQUE INDEX `account_wechatMini_userId_unique` ON `account` (`user_id`) WHERE "account"."provider_id" = 'wechat-mini';
