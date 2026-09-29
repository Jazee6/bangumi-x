import { sql } from "drizzle-orm";
import { check, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";
import { v7 as uuidv7 } from "uuid";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull(),
  image: text("image"),
  isAnonymous: integer("is_anonymous", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const session = sqliteTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    uniqueIndex("session_token_unique").on(table.token),
    index("session_user_id_idx").on(table.userId),
  ],
);

export const account = sqliteTable(
  "account",
  {
    id: text("id").primaryKey(),
    issuer: text("issuer").notNull(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("account_issuer_account_unique").on(table.issuer, table.accountId),
    uniqueIndex("account_wechat_user_unique")
      .on(table.userId)
      .where(sql`${table.providerId} = 'wechat-mini'`),
    index("account_provider_id_idx").on(table.providerId),
    index("account_user_id_idx").on(table.userId),
  ],
);

export const verification = sqliteTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

export const miniProfile = sqliteTable("mini_profile", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  avatarKey: text("avatar_key"),
  mutationDay: text("mutation_day"),
  mutationCount: integer("mutation_count").notNull().default(0),
  linkClaimWindowStartedAt: integer("link_claim_window_started_at", { mode: "timestamp_ms" }),
  linkClaimFailureCount: integer("link_claim_failure_count").notNull().default(0),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const miniAccountLinkRequest = sqliteTable(
  "mini_account_link_request",
  {
    tokenHash: text("token_hash").primaryKey(),
    shortCodeHash: text("short_code_hash").notNull(),
    claimTokenHash: text("claim_token_hash"),
    sourceUserId: text("source_user_id"),
    targetUserId: text("target_user_id").notNull(),
    status: text("status", {
      enum: ["awaiting_source", "awaiting_confirmation", "complete", "failed"],
    }).notNull(),
    previewVersion: text("preview_version"),
    resultSessionToken: text("result_session_token"),
    errorCode: text("error_code"),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
    completedAt: integer("completed_at", { mode: "timestamp_ms" }),
  },
  (table) => [
    uniqueIndex("mini_account_link_short_code_unique").on(table.shortCodeHash),
    uniqueIndex("mini_account_link_claim_token_unique").on(table.claimTokenHash),
    index("mini_account_link_target_status_idx").on(table.targetUserId, table.status),
    index("mini_account_link_source_status_idx").on(table.sourceUserId, table.status),
    index("mini_account_link_expires_idx").on(table.expiresAt),
  ],
);

export const userMergeAudit = sqliteTable(
  "user_merge_audit",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    sourceUserId: text("source_user_id").notNull(),
    targetUserId: text("target_user_id").notNull(),
    resultType: text("result_type", { enum: ["user_merge"] }).notNull(),
    collectionCount: integer("collection_count").notNull(),
    progressCount: integer("progress_count").notNull(),
    listCount: integer("list_count").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("user_merge_audit_target_created_idx").on(table.targetUserId, table.createdAt)],
);

export const wechatAccessToken = sqliteTable("wechat_access_token", {
  key: text("key").primaryKey(),
  token: text("token").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const publicEntityDirectory = sqliteTable(
  "public_entity_directory",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    resourceType: text("resource_type", {
      enum: ["subject", "chapter", "character", "person", "collection_list", "ranking"],
    }).notNull(),
    externalId: text("external_id").notNull(),
    discoverySource: text("discovery_source", {
      enum: [
        "daily_broadcast",
        "annual_popular",
        "rankings",
        "relation",
        "direct_access",
        "collection_list",
      ],
    }).notNull(),
    firstDiscoveredAt: integer("first_discovered_at", { mode: "timestamp_ms" }).notNull(),
    lastVerifiedAt: integer("last_verified_at", { mode: "timestamp_ms" }),
    indexStatus: text("index_status", { enum: ["pending", "index", "noindex"] }).notNull(),
    indexReason: text("index_reason").notNull(),
  },
  (table) => [
    uniqueIndex("public_entity_directory_resource_external_unique").on(
      table.resourceType,
      table.externalId,
    ),
    index("public_entity_directory_resource_status_verified_idx").on(
      table.resourceType,
      table.indexStatus,
      table.lastVerifiedAt,
    ),
    index("public_entity_directory_resource_status_external_idx").on(
      table.resourceType,
      table.indexStatus,
      table.externalId,
    ),
  ],
);

export const directorySyncState = sqliteTable("directory_sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

export const subjectSnapshot = sqliteTable(
  "subject_snapshot",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    subjectId: integer("subject_id").notNull(),
    title: text("title").notNull(),
    type: text("type").notNull(),
    posterSourceUrl: text("poster_source_url"),
    nsfw: integer("nsfw", { mode: "boolean" }).notNull(),
    totalChapters: integer("total_chapters"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("subject_snapshot_subject_id_unique").on(table.subjectId),
    index("subject_snapshot_updated_at_idx").on(table.updatedAt),
  ],
);

export const broadcastSnapshot = sqliteTable(
  "broadcast_snapshot",
  {
    subjectId: integer("subject_id").primaryKey(),
    chapters: text("chapters", { mode: "json" })
      .$type<Array<{ sequence: number; date: string }>>()
      .notNull(),
    completeAfter: text("complete_after"),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [index("broadcast_snapshot_updated_at_idx").on(table.updatedAt)],
);

export const progress = sqliteTable(
  "progress",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjectSnapshot.subjectId),
    stage: text("stage", { enum: ["in_progress", "completed"] }).notNull(),
    completedChapters: integer("completed_chapters"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("progress_user_subject_unique").on(table.userId, table.subjectId),
    check("progress_stage_check", sql`${table.stage} in ('in_progress', 'completed')`),
    check(
      "progress_completed_chapters_non_negative",
      sql`${table.completedChapters} is null or ${table.completedChapters} >= 0`,
    ),
    index("progress_user_stage_updated_subject_idx").on(
      table.userId,
      table.stage,
      table.updatedAt,
      table.subjectId,
    ),
    index("progress_user_updated_subject_idx").on(table.userId, table.updatedAt, table.subjectId),
    index("progress_subject_id_idx").on(table.subjectId),
  ],
);

export const collectionList = sqliteTable(
  "collection_list",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(false),
    shareToken: text("share_token").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    check("collection_list_name_length_check", sql`length(${table.name}) between 1 and 50`),
    uniqueIndex("collection_list_user_name_unique").on(table.userId, table.name),
    uniqueIndex("collection_list_share_token_unique").on(table.shareToken),
    index("collection_list_user_created_id_idx").on(table.userId, table.createdAt, table.id),
  ],
);

export const collectionListMember = sqliteTable(
  "collection_list_member",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    listId: text("list_id")
      .notNull()
      .references(() => collectionList.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjectSnapshot.subjectId),
    addedAt: integer("added_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("collection_list_member_list_subject_unique").on(table.listId, table.subjectId),
    index("collection_list_member_list_added_subject_idx").on(
      table.listId,
      table.addedAt,
      table.subjectId,
    ),
    index("collection_list_member_subject_id_idx").on(table.subjectId),
  ],
);

export const collection = sqliteTable(
  "collection",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => uuidv7()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subjectId: integer("subject_id")
      .notNull()
      .references(() => subjectSnapshot.subjectId),
    collectedAt: integer("collected_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [
    uniqueIndex("collection_user_subject_unique").on(table.userId, table.subjectId),
    index("collection_user_collected_subject_idx").on(
      table.userId,
      table.collectedAt,
      table.subjectId,
    ),
    index("collection_subject_id_idx").on(table.subjectId),
  ],
);
