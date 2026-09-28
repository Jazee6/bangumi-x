import { and, desc, eq, exists, inArray, notExists, notInArray, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { v7 as uuidv7 } from "uuid";

import {
  collection,
  collectionList,
  collectionListMember,
  progress as progressTable,
  subjectSnapshot,
  user,
} from "./db/schema";

import type { D1Database } from "@cloudflare/workers-types";
import type { ProgressStage, SubjectProgress, SubjectType } from "share";
import type { SubjectSnapshotInput } from "./subject-snapshot";

export interface SubjectSnapshotRecord extends SubjectSnapshotInput {
  updatedAt: Date;
}

export interface StoredCollectionItem extends SubjectSnapshotRecord {
  collectedAt: Date;
  progress: SubjectProgress | null;
}

export interface StoredProgressRecord {
  id: string;
  userId: string;
  subjectId: number;
  stage: ProgressStage;
  completedChapters: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoredProgressItem extends SubjectSnapshotRecord {
  stage: ProgressStage;
  completedChapters: number | null;
  progressCreatedAt: Date;
  progressUpdatedAt: Date;
  collectedAt: Date | null;
}

export interface StoredCollectionPage {
  data: StoredCollectionItem[];
  total: number;
}

export interface StoredPublicCollectionItem extends SubjectSnapshotRecord {
  addedAt: Date;
}

export interface StoredPublicCollectionListPage {
  list: StoredCollectionList;
  ownerName: string;
  data: StoredPublicCollectionItem[];
  total: number;
}

export interface StoredProgressPage {
  data: StoredProgressItem[];
  total: number;
}

export interface ContentVisibilityFilters {
  excludeNsfw?: boolean;
}

export interface PersonalRecordFilters extends ContentVisibilityFilters {
  list?: "unlisted" | string;
  type?: SubjectType;
  keyword?: string;
}

export interface ProgressRecordFilters extends ContentVisibilityFilters {
  type?: SubjectType;
  stage?: ProgressStage;
  keyword?: string;
}

export interface StoredCollectionList {
  id: string;
  userId: string;
  name: string;
  isPublic: boolean;
  shareToken: string;
  createdAt: Date;
  updatedAt: Date;
  count?: number;
}

export interface StoredPersonalRecordCounts {
  collections: { all: number; unlisted: number };
  progress: { all: number; in_progress: number; completed: number };
}

const collectionSelection = {
  subjectId: subjectSnapshot.subjectId,
  title: subjectSnapshot.title,
  type: subjectSnapshot.type,
  posterSourceUrl: subjectSnapshot.posterSourceUrl,
  nsfw: subjectSnapshot.nsfw,
  totalChapters: subjectSnapshot.totalChapters,
  updatedAt: subjectSnapshot.updatedAt,
  collectedAt: collection.collectedAt,
  progressStage: progressTable.stage,
  progressCompletedChapters: progressTable.completedChapters,
  progressUpdatedAt: progressTable.updatedAt,
};

const progressSelection = {
  subjectId: subjectSnapshot.subjectId,
  title: subjectSnapshot.title,
  type: subjectSnapshot.type,
  posterSourceUrl: subjectSnapshot.posterSourceUrl,
  nsfw: subjectSnapshot.nsfw,
  totalChapters: subjectSnapshot.totalChapters,
  snapshotUpdatedAt: subjectSnapshot.updatedAt,
  stage: progressTable.stage,
  completedChapters: progressTable.completedChapters,
  progressCreatedAt: progressTable.createdAt,
  progressUpdatedAt: progressTable.updatedAt,
  collectedAt: collection.collectedAt,
};

const publicCollectionSelection = {
  subjectId: subjectSnapshot.subjectId,
  title: subjectSnapshot.title,
  type: subjectSnapshot.type,
  posterSourceUrl: subjectSnapshot.posterSourceUrl,
  nsfw: subjectSnapshot.nsfw,
  totalChapters: subjectSnapshot.totalChapters,
  updatedAt: subjectSnapshot.updatedAt,
  addedAt: collectionListMember.addedAt,
};

export interface CollectionRepository {
  getSnapshot: (subjectId: number) => Promise<SubjectSnapshotRecord | null>;
  getCollection: (userId: string, subjectId: number) => Promise<StoredCollectionItem | null>;
  listCollections: (
    userId: string,
    limit: number,
    offset: number,
    filters?: PersonalRecordFilters,
  ) => Promise<StoredCollectionPage>;
  removeCollection: (userId: string, subjectId: number, updatedAt: Date) => Promise<void>;
  getProgress: (userId: string, subjectId: number) => Promise<StoredProgressRecord | null>;
  listProgress: (
    userId: string,
    limit: number,
    offset: number,
    filters?: ProgressRecordFilters,
  ) => Promise<StoredProgressPage>;
  setProgress: (
    userId: string,
    snapshot: SubjectSnapshotRecord,
    stage: ProgressStage,
    completedChapters: number | null,
    updatedAt: Date,
  ) => Promise<StoredProgressRecord>;
  clearProgress: (userId: string, subjectId: number) => Promise<void>;
  getCollectionListIds: (userId: string, subjectId: number) => Promise<string[]>;
  setCollection: (
    userId: string,
    snapshot: SubjectSnapshotRecord,
    listIds: string[],
    collectedAt: Date,
  ) => Promise<boolean>;
  listCollectionLists: (
    userId: string,
    filters?: ContentVisibilityFilters,
  ) => Promise<StoredCollectionList[]>;
  getPersonalRecordCounts: (
    userId: string,
    filters?: ContentVisibilityFilters,
  ) => Promise<StoredPersonalRecordCounts>;
  createCollectionList: (
    userId: string,
    input: { id: string; name: string; shareToken: string; now: Date },
  ) => Promise<StoredCollectionList | null>;
  renameCollectionList: (
    userId: string,
    listId: string,
    name: string,
    updatedAt: Date,
  ) => Promise<"updated" | "not_found" | "duplicate">;
  setCollectionListVisibility: (
    userId: string,
    listId: string,
    isPublic: boolean,
    updatedAt: Date,
  ) => Promise<StoredCollectionList | null>;
  getPublicCollectionList: (
    shareToken: string,
    limit: number,
    offset: number,
    filters?: ContentVisibilityFilters,
  ) => Promise<StoredPublicCollectionListPage | null>;
  refreshSnapshot: (snapshot: SubjectSnapshotRecord) => Promise<boolean>;
  deleteCollectionList: (userId: string, listId: string) => Promise<boolean>;
  removeCollectionListMember: (
    userId: string,
    listId: string,
    subjectId: number,
    updatedAt: Date,
  ) => Promise<boolean>;
}

export function createD1CollectionRepository(database: D1Database): CollectionRepository {
  const db = drizzle(database, {
    schema: {
      user,
      collection,
      collectionList,
      collectionListMember,
      subjectSnapshot,
      progress: progressTable,
    },
  });

  return {
    async getSnapshot(subjectId) {
      const row = (await db.query.subjectSnapshot.findFirst({
        where: eq(subjectSnapshot.subjectId, subjectId),
      })) as SubjectSnapshotRecord | undefined;
      return row ? { ...row, type: row.type as SubjectType } : null;
    },
    async getCollection(userId, subjectId) {
      const rows = await db
        .select(collectionSelection)
        .from(collection)
        .innerJoin(subjectSnapshot, eq(collection.subjectId, subjectSnapshot.subjectId))
        .leftJoin(
          progressTable,
          and(
            eq(progressTable.userId, collection.userId),
            eq(progressTable.subjectId, collection.subjectId),
          ),
        )
        .where(and(eq(collection.userId, userId), eq(collection.subjectId, subjectId)))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      return {
        subjectId: row.subjectId,
        title: row.title,
        type: row.type as SubjectType,
        posterSourceUrl: row.posterSourceUrl,
        nsfw: row.nsfw,
        totalChapters: row.totalChapters,
        updatedAt: row.updatedAt,
        collectedAt: row.collectedAt,
        progress:
          row.progressStage && row.progressUpdatedAt
            ? {
                stage: row.progressStage,
                completedChapters: row.progressCompletedChapters,
                totalChapters: row.totalChapters,
                updatedAt: row.progressUpdatedAt.toISOString(),
              }
            : null,
      };
    },
    async listCollections(userId, limit, offset, filters = {}) {
      const conditions = [eq(collection.userId, userId)];
      if (filters.excludeNsfw) conditions.push(eq(subjectSnapshot.nsfw, false));
      if (filters.type) conditions.push(eq(subjectSnapshot.type, filters.type));
      if (filters.keyword) {
        conditions.push(sql`instr(lower(${subjectSnapshot.title}), lower(${filters.keyword})) > 0`);
      }
      if (filters.list === "unlisted") {
        conditions.push(
          notExists(
            db
              .select({ value: sql`1` })
              .from(collectionListMember)
              .innerJoin(collectionList, eq(collectionListMember.listId, collectionList.id))
              .where(
                and(
                  eq(collectionList.userId, userId),
                  eq(collectionListMember.subjectId, collection.subjectId),
                ),
              ),
          ),
        );
      }
      const progressJoin = and(
        eq(progressTable.userId, collection.userId),
        eq(progressTable.subjectId, collection.subjectId),
      );
      let pageQuery = db
        .select(collectionSelection)
        .from(collection)
        .innerJoin(subjectSnapshot, eq(collection.subjectId, subjectSnapshot.subjectId))
        .leftJoin(progressTable, progressJoin)
        .$dynamic();
      let countQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(collection)
        .innerJoin(subjectSnapshot, eq(collection.subjectId, subjectSnapshot.subjectId))
        .leftJoin(progressTable, progressJoin)
        .$dynamic();
      if (filters.list && filters.list !== "unlisted") {
        pageQuery = pageQuery
          .innerJoin(
            collectionListMember,
            and(
              eq(collectionListMember.subjectId, collection.subjectId),
              eq(collectionListMember.listId, filters.list),
            ),
          )
          .innerJoin(
            collectionList,
            and(
              eq(collectionList.id, collectionListMember.listId),
              eq(collectionList.userId, userId),
            ),
          );
        countQuery = countQuery
          .innerJoin(
            collectionListMember,
            and(
              eq(collectionListMember.subjectId, collection.subjectId),
              eq(collectionListMember.listId, filters.list),
            ),
          )
          .innerJoin(
            collectionList,
            and(
              eq(collectionList.id, collectionListMember.listId),
              eq(collectionList.userId, userId),
            ),
          );
      }
      const where = and(...conditions);
      const [rows, totals] = await Promise.all([
        pageQuery
          .where(where)
          .orderBy(
            filters.list && filters.list !== "unlisted"
              ? desc(collectionListMember.addedAt)
              : desc(collection.collectedAt),
            desc(collection.subjectId),
          )
          .limit(limit)
          .offset(offset),
        countQuery.where(where),
      ]);
      return {
        data: rows.map((row) => ({
          subjectId: row.subjectId,
          title: row.title,
          type: row.type as SubjectType,
          posterSourceUrl: row.posterSourceUrl,
          nsfw: row.nsfw,
          totalChapters: row.totalChapters,
          updatedAt: row.updatedAt,
          collectedAt: row.collectedAt,
          progress:
            row.progressStage && row.progressUpdatedAt
              ? {
                  stage: row.progressStage,
                  completedChapters: row.progressCompletedChapters,
                  totalChapters: row.totalChapters,
                  updatedAt: row.progressUpdatedAt.toISOString(),
                }
              : null,
        })),
        total: totals[0]?.count ?? 0,
      };
    },
    async removeCollection(userId, subjectId, updatedAt) {
      const currentMembership = db
        .select({ id: collectionListMember.id })
        .from(collectionListMember)
        .where(
          and(
            eq(collectionListMember.listId, collectionList.id),
            eq(collectionListMember.subjectId, subjectId),
          ),
        );
      const ownedListIds = db
        .select({ id: collectionList.id })
        .from(collectionList)
        .where(eq(collectionList.userId, userId));
      await db.batch([
        db
          .update(collectionList)
          .set({ updatedAt })
          .where(and(eq(collectionList.userId, userId), exists(currentMembership))),
        db
          .delete(collectionListMember)
          .where(
            and(
              eq(collectionListMember.subjectId, subjectId),
              inArray(collectionListMember.listId, ownedListIds),
            ),
          ),
        db
          .delete(collection)
          .where(and(eq(collection.userId, userId), eq(collection.subjectId, subjectId))),
      ]);
    },
    async getProgress(userId, subjectId) {
      return (
        ((await db.query.progress.findFirst({
          where: and(eq(progressTable.userId, userId), eq(progressTable.subjectId, subjectId)),
        })) as StoredProgressRecord | undefined) ?? null
      );
    },
    async listProgress(userId, limit, offset, filters = {}) {
      const conditions = [eq(progressTable.userId, userId)];
      if (filters.excludeNsfw) conditions.push(eq(subjectSnapshot.nsfw, false));
      if (filters.type) conditions.push(eq(subjectSnapshot.type, filters.type));
      if (filters.stage) conditions.push(eq(progressTable.stage, filters.stage));
      if (filters.keyword) {
        conditions.push(sql`instr(lower(${subjectSnapshot.title}), lower(${filters.keyword})) > 0`);
      }
      const where = and(...conditions);
      const [rows, totals] = await Promise.all([
        db
          .select(progressSelection)
          .from(progressTable)
          .innerJoin(subjectSnapshot, eq(progressTable.subjectId, subjectSnapshot.subjectId))
          .leftJoin(
            collection,
            and(
              eq(collection.userId, progressTable.userId),
              eq(collection.subjectId, progressTable.subjectId),
            ),
          )
          .where(where)
          .orderBy(desc(progressTable.createdAt), desc(progressTable.subjectId))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(progressTable)
          .innerJoin(subjectSnapshot, eq(progressTable.subjectId, subjectSnapshot.subjectId))
          .where(where),
      ]);
      return {
        data: rows.map(({ snapshotUpdatedAt, ...row }) => ({
          ...row,
          type: row.type as SubjectType,
          updatedAt: snapshotUpdatedAt,
        })),
        total: totals[0]?.count ?? 0,
      };
    },
    async setProgress(userId, snapshot, stage, completedChapters, updatedAt) {
      const existing = (await db.query.progress.findFirst({
        where: and(
          eq(progressTable.userId, userId),
          eq(progressTable.subjectId, snapshot.subjectId),
        ),
      })) as StoredProgressRecord | undefined;

      if (
        existing &&
        existing.stage === stage &&
        existing.completedChapters === completedChapters
      ) {
        return existing;
      }

      await db
        .insert(subjectSnapshot)
        .values({
          id: uuidv7(),
          subjectId: snapshot.subjectId,
          title: snapshot.title,
          type: snapshot.type,
          posterSourceUrl: snapshot.posterSourceUrl,
          nsfw: snapshot.nsfw,
          totalChapters: snapshot.totalChapters,
          updatedAt: snapshot.updatedAt,
        })
        .onConflictDoNothing({ target: subjectSnapshot.subjectId });

      const rows = await db
        .insert(progressTable)
        .values({
          id: uuidv7(),
          userId,
          subjectId: snapshot.subjectId,
          stage,
          completedChapters,
          createdAt: updatedAt,
          updatedAt,
        })
        .onConflictDoUpdate({
          target: [progressTable.userId, progressTable.subjectId],
          set: { stage, completedChapters, updatedAt },
        })
        .returning();

      return rows[0] as StoredProgressRecord;
    },
    async clearProgress(userId, subjectId) {
      await db
        .delete(progressTable)
        .where(and(eq(progressTable.userId, userId), eq(progressTable.subjectId, subjectId)));
    },
    async getCollectionListIds(userId, subjectId) {
      const rows = await db
        .select({ id: collectionList.id })
        .from(collectionListMember)
        .innerJoin(collectionList, eq(collectionListMember.listId, collectionList.id))
        .where(
          and(eq(collectionList.userId, userId), eq(collectionListMember.subjectId, subjectId)),
        )
        .orderBy(collectionList.id);
      return rows.map((row) => row.id);
    },
    async setCollection(userId, snapshot, listIds, collectedAt) {
      const uniqueListIds = [...new Set(listIds)];
      if (uniqueListIds.length > 0) {
        const owned = await db
          .select({ id: collectionList.id })
          .from(collectionList)
          .where(and(eq(collectionList.userId, userId), inArray(collectionList.id, uniqueListIds)));
        if (owned.length !== uniqueListIds.length) return false;
      }

      const currentMembership = db
        .select({ id: collectionListMember.id })
        .from(collectionListMember)
        .where(
          and(
            eq(collectionListMember.listId, collectionList.id),
            eq(collectionListMember.subjectId, snapshot.subjectId),
          ),
        );
      const changedMembership =
        uniqueListIds.length > 0
          ? or(
              and(inArray(collectionList.id, uniqueListIds), notExists(currentMembership)),
              and(notInArray(collectionList.id, uniqueListIds), exists(currentMembership)),
            )
          : exists(currentMembership);
      const ownedListIds = db
        .select({ id: collectionList.id })
        .from(collectionList)
        .where(eq(collectionList.userId, userId));
      const statements = [
        db
          .update(collectionList)
          .set({ updatedAt: collectedAt })
          .where(and(eq(collectionList.userId, userId), changedMembership)),
        db
          .insert(subjectSnapshot)
          .values({
            id: uuidv7(),
            subjectId: snapshot.subjectId,
            title: snapshot.title,
            type: snapshot.type,
            posterSourceUrl: snapshot.posterSourceUrl,
            nsfw: snapshot.nsfw,
            totalChapters: snapshot.totalChapters,
            updatedAt: snapshot.updatedAt,
          })
          .onConflictDoNothing({ target: subjectSnapshot.subjectId }),
        db
          .insert(collection)
          .values({ id: uuidv7(), userId, subjectId: snapshot.subjectId, collectedAt })
          .onConflictDoNothing({ target: [collection.userId, collection.subjectId] }),
        db
          .delete(collectionListMember)
          .where(
            and(
              eq(collectionListMember.subjectId, snapshot.subjectId),
              inArray(collectionListMember.listId, ownedListIds),
              ...(uniqueListIds.length > 0
                ? [notInArray(collectionListMember.listId, uniqueListIds)]
                : []),
            ),
          ),
        ...uniqueListIds.map((listId) =>
          db
            .insert(collectionListMember)
            .values({ id: uuidv7(), listId, subjectId: snapshot.subjectId, addedAt: collectedAt })
            .onConflictDoNothing({
              target: [collectionListMember.listId, collectionListMember.subjectId],
            }),
        ),
      ] as const;
      await db.batch(statements);
      return true;
    },
    async listCollectionLists(userId, filters = {}) {
      const countExpression = filters.excludeNsfw
        ? sql<number>`count(case when ${subjectSnapshot.nsfw} = 0 then ${collectionListMember.subjectId} end)`
        : sql<number>`count(${collectionListMember.subjectId})`;
      const rows = await db
        .select({
          id: collectionList.id,
          userId: collectionList.userId,
          name: collectionList.name,
          isPublic: collectionList.isPublic,
          shareToken: collectionList.shareToken,
          createdAt: collectionList.createdAt,
          updatedAt: collectionList.updatedAt,
          count: countExpression,
        })
        .from(collectionList)
        .leftJoin(collectionListMember, eq(collectionListMember.listId, collectionList.id))
        .leftJoin(subjectSnapshot, eq(collectionListMember.subjectId, subjectSnapshot.subjectId))
        .where(eq(collectionList.userId, userId))
        .groupBy(collectionList.id)
        .orderBy(desc(collectionList.createdAt), desc(collectionList.id));
      return rows as StoredCollectionList[];
    },
    async getPersonalRecordCounts(userId, filters = {}) {
      const collectionConditions = [eq(collection.userId, userId)];
      const progressConditions = [eq(progressTable.userId, userId)];
      if (filters.excludeNsfw) {
        collectionConditions.push(eq(subjectSnapshot.nsfw, false));
        progressConditions.push(eq(subjectSnapshot.nsfw, false));
      }
      const [collectionRows, progressRows, unlistedRows] = await Promise.all([
        db
          .select({ count: sql<number>`count(*)` })
          .from(collection)
          .innerJoin(subjectSnapshot, eq(collection.subjectId, subjectSnapshot.subjectId))
          .where(and(...collectionConditions)),
        db
          .select({ stage: progressTable.stage, count: sql<number>`count(*)` })
          .from(progressTable)
          .innerJoin(subjectSnapshot, eq(progressTable.subjectId, subjectSnapshot.subjectId))
          .where(and(...progressConditions))
          .groupBy(progressTable.stage),
        db
          .select({ count: sql<number>`count(*)` })
          .from(collection)
          .innerJoin(subjectSnapshot, eq(collection.subjectId, subjectSnapshot.subjectId))
          .where(
            and(
              ...collectionConditions,
              notExists(
                db
                  .select({ subjectId: collectionListMember.subjectId })
                  .from(collectionListMember)
                  .innerJoin(collectionList, eq(collectionList.id, collectionListMember.listId))
                  .where(
                    and(
                      eq(collectionList.userId, userId),
                      eq(collectionListMember.subjectId, collection.subjectId),
                    ),
                  ),
              ),
            ),
          ),
      ]);
      const progressStages = { in_progress: 0, completed: 0 };
      for (const row of progressRows) {
        if (row.stage === "in_progress" || row.stage === "completed") {
          progressStages[row.stage] = row.count;
        }
      }
      return {
        collections: { all: collectionRows[0]?.count ?? 0, unlisted: unlistedRows[0]?.count ?? 0 },
        progress: {
          all: progressStages.in_progress + progressStages.completed,
          in_progress: progressStages.in_progress,
          completed: progressStages.completed,
        },
      };
    },
    async createCollectionList(userId, input) {
      const rows = await db
        .insert(collectionList)
        .values({
          id: input.id,
          userId,
          name: input.name,
          isPublic: false,
          shareToken: input.shareToken,
          createdAt: input.now,
          updatedAt: input.now,
        })
        .onConflictDoNothing()
        .returning();
      return (rows[0] as StoredCollectionList | undefined) ?? null;
    },
    async renameCollectionList(userId, listId, name, updatedAt) {
      const duplicate = await db.query.collectionList.findFirst({
        columns: { id: true },
        where: and(eq(collectionList.userId, userId), eq(collectionList.name, name)),
      });
      if (duplicate && duplicate.id !== listId) return "duplicate";
      try {
        const rows = await db
          .update(collectionList)
          .set({ name, updatedAt })
          .where(and(eq(collectionList.id, listId), eq(collectionList.userId, userId)))
          .returning({ id: collectionList.id });
        return rows.length === 0 ? "not_found" : "updated";
      } catch (error) {
        if (String(error).includes("UNIQUE constraint failed")) return "duplicate";
        throw error;
      }
    },
    async setCollectionListVisibility(userId, listId, isPublic, updatedAt) {
      const rows = await db
        .update(collectionList)
        .set({ isPublic, updatedAt })
        .where(and(eq(collectionList.id, listId), eq(collectionList.userId, userId)))
        .returning();
      return (rows[0] as StoredCollectionList | undefined) ?? null;
    },
    async getPublicCollectionList(shareToken, limit, offset, filters = {}) {
      const rows = await db
        .select({
          list: collectionList,
          ownerName: user.name,
        })
        .from(collectionList)
        .innerJoin(user, eq(collectionList.userId, user.id))
        .where(and(eq(collectionList.shareToken, shareToken), eq(collectionList.isPublic, true)))
        .limit(1);
      const row = rows[0];
      if (!row) return null;
      const memberCondition = and(
        eq(collectionListMember.listId, row.list.id),
        ...(filters.excludeNsfw ? [eq(subjectSnapshot.nsfw, false)] : []),
      );
      const [itemRows, totals] = await Promise.all([
        db
          .select(publicCollectionSelection)
          .from(collectionListMember)
          .innerJoin(subjectSnapshot, eq(collectionListMember.subjectId, subjectSnapshot.subjectId))
          .where(memberCondition)
          .orderBy(desc(collectionListMember.addedAt), desc(collectionListMember.subjectId))
          .limit(limit)
          .offset(offset),
        db
          .select({ count: sql<number>`count(*)` })
          .from(collectionListMember)
          .innerJoin(subjectSnapshot, eq(collectionListMember.subjectId, subjectSnapshot.subjectId))
          .where(memberCondition),
      ]);
      return {
        list: row.list as StoredCollectionList,
        ownerName: row.ownerName,
        data: itemRows.map((item) => ({ ...item, type: item.type as SubjectType })),
        total: totals[0]?.count ?? 0,
      };
    },
    async refreshSnapshot(snapshot) {
      const existing = await db.query.subjectSnapshot.findFirst({
        where: eq(subjectSnapshot.subjectId, snapshot.subjectId),
      });
      const rows = await db
        .update(subjectSnapshot)
        .set({
          title: snapshot.title,
          type: snapshot.type,
          posterSourceUrl: snapshot.posterSourceUrl,
          nsfw: snapshot.nsfw,
          totalChapters: snapshot.totalChapters,
          updatedAt: snapshot.updatedAt,
        })
        .where(eq(subjectSnapshot.subjectId, snapshot.subjectId))
        .returning({ subjectId: subjectSnapshot.subjectId });
      if (rows.length === 0) return false;

      const oldTotal = existing?.totalChapters ?? null;
      const newTotal = snapshot.totalChapters ?? null;

      if (
        (snapshot.type === "动画" || snapshot.type === "三次元") &&
        newTotal !== null &&
        newTotal > 0
      ) {
        if (oldTotal === null || oldTotal === 0) {
          // Unknown -> Known: reconcile both manually completed and count-driven progress without modifying updated_at.
          await db.batch([
            db
              .update(progressTable)
              .set({ completedChapters: newTotal })
              .where(
                and(
                  eq(progressTable.subjectId, snapshot.subjectId),
                  eq(progressTable.stage, "completed"),
                  sql`(${progressTable.completedChapters} is null or ${progressTable.completedChapters} < ${newTotal})`,
                ),
              ),
            db
              .update(progressTable)
              .set({ stage: "completed" })
              .where(
                and(
                  eq(progressTable.subjectId, snapshot.subjectId),
                  eq(progressTable.stage, "in_progress"),
                  sql`${progressTable.completedChapters} is not null and ${progressTable.completedChapters} >= ${newTotal}`,
                ),
              ),
          ]);
        } else if (newTotal > oldTotal) {
          // Total growth: completed progress with count < newTotal reverts to in_progress (updated_at NOT modified)
          await db
            .update(progressTable)
            .set({ stage: "in_progress" })
            .where(
              and(
                eq(progressTable.subjectId, snapshot.subjectId),
                eq(progressTable.stage, "completed"),
                sql`${progressTable.completedChapters} is not null and ${progressTable.completedChapters} < ${newTotal}`,
              ),
            );
        } else if (newTotal < oldTotal) {
          // Total reduced: in_progress with count >= newTotal becomes completed (updated_at NOT modified)
          await db
            .update(progressTable)
            .set({ stage: "completed" })
            .where(
              and(
                eq(progressTable.subjectId, snapshot.subjectId),
                eq(progressTable.stage, "in_progress"),
                sql`${progressTable.completedChapters} is not null and ${progressTable.completedChapters} >= ${newTotal}`,
              ),
            );
        }
      }

      return true;
    },
    async deleteCollectionList(userId, listId) {
      const owned = await db.query.collectionList.findFirst({
        columns: { id: true },
        where: and(eq(collectionList.id, listId), eq(collectionList.userId, userId)),
      });
      if (!owned) return false;
      await db.batch([
        db.delete(collectionListMember).where(eq(collectionListMember.listId, listId)),
        db
          .delete(collectionList)
          .where(and(eq(collectionList.id, listId), eq(collectionList.userId, userId))),
      ]);
      return true;
    },
    async removeCollectionListMember(userId, listId, subjectId, updatedAt) {
      const owned = await db.query.collectionList.findFirst({
        columns: { id: true },
        where: and(eq(collectionList.id, listId), eq(collectionList.userId, userId)),
      });
      if (!owned) return false;
      const currentMembership = db
        .select({ id: collectionListMember.id })
        .from(collectionListMember)
        .where(
          and(
            eq(collectionListMember.listId, collectionList.id),
            eq(collectionListMember.subjectId, subjectId),
          ),
        );
      await db.batch([
        db
          .update(collectionList)
          .set({ updatedAt })
          .where(and(eq(collectionList.id, listId), exists(currentMembership))),
        db
          .delete(collectionListMember)
          .where(
            and(
              eq(collectionListMember.listId, listId),
              eq(collectionListMember.subjectId, subjectId),
            ),
          ),
      ]);
      return true;
    },
  };
}
