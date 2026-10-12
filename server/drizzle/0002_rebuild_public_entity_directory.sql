-- See ADR 0014: keep only seeded, indexable rows; crawl-driven direct_access rows are dropped.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_public_entity_directory` (
	`resource_type` text NOT NULL,
	`external_id` text NOT NULL,
	`discovery_source` text NOT NULL,
	`first_discovered_at` integer NOT NULL,
	`last_verified_at` integer,
	`index_status` text NOT NULL,
	`index_reason` text NOT NULL,
	PRIMARY KEY(`resource_type`, `external_id`)
) WITHOUT ROWID;
--> statement-breakpoint
INSERT INTO `__new_public_entity_directory`("resource_type", "external_id", "discovery_source", "first_discovered_at", "last_verified_at", "index_status", "index_reason") SELECT "resource_type", "external_id", "discovery_source", "first_discovered_at", "last_verified_at", "index_status", "index_reason" FROM `public_entity_directory` WHERE "resource_type" <> 'chapter' AND "discovery_source" <> 'direct_access' AND "index_status" <> 'noindex';--> statement-breakpoint
DROP TABLE `public_entity_directory`;--> statement-breakpoint
ALTER TABLE `__new_public_entity_directory` RENAME TO `public_entity_directory`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `public_entity_directory_resource_status_verified_idx` ON `public_entity_directory` (`resource_type`,`index_status`,`last_verified_at`);