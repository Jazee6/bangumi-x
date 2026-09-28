import { and, asc, eq, gt, inArray, isNull, lt, lte, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { v7 as uuidv7 } from "uuid";

import type { DirectoryDiscoverySource, DirectoryIndexStatus, DirectoryResourceType } from "share";

import { directorySyncState, publicEntityDirectory } from "./db/schema";

import type { D1Database } from "@cloudflare/workers-types";

export interface DirectoryDiscovery {
  resourceType: DirectoryResourceType;
  externalId: string;
  discoverySource: DirectoryDiscoverySource;
  indexStatus: DirectoryIndexStatus;
  indexReason: string;
}

export interface DirectoryEntry extends DirectoryDiscovery {
  firstDiscoveredAt: Date;
  lastVerifiedAt: Date | null;
}

export interface DirectoryQuery {
  resourceType: DirectoryResourceType;
  indexStatus?: DirectoryIndexStatus;
  limit: number;
  offset?: number;
  cursor?: string;
}

export interface DirectoryPage {
  entries: DirectoryEntry[];
  nextCursor: string | null;
}

export interface StaleDirectoryQuery {
  resourceTypes: readonly DirectoryResourceType[];
  verifiedBefore: Date;
  limit: number;
}

export interface DirectorySyncState {
  value: string;
  updatedAt: Date;
}

export interface DirectoryRepository {
  recordDiscoveries(items: readonly DirectoryDiscovery[], verifiedAt: Date): Promise<void>;
  listEntries(query: DirectoryQuery): Promise<DirectoryEntry[]>;
  listPage(query: DirectoryQuery): Promise<DirectoryPage>;
  listStaleEntries(query: StaleDirectoryQuery): Promise<DirectoryEntry[]>;
  getSyncState(key: string): Promise<DirectorySyncState | null>;
  setSyncState(key: string, value: string, updatedAt: Date): Promise<void>;
  acquireSyncLease(
    key: string,
    value: string,
    acquiredAt: Date,
    expiresBefore: Date,
  ): Promise<boolean>;
}

const REVERIFY_AFTER_MS = 24 * 60 * 60 * 1000;
const EXISTING_LOOKUP_CHUNK = 90;

type ExistingDirectoryState = Pick<
  DirectoryEntry,
  "indexStatus" | "indexReason" | "lastVerifiedAt"
>;

/**
 * Pending discoveries only ever create rows. A verified row is rewritten when its index decision
 * changes, or at most once a day to refresh its verification time; this keeps D1 writes bounded.
 */
function needsDirectoryWrite(
  existing: ExistingDirectoryState | undefined,
  item: DirectoryDiscovery,
  verifiedAt: Date,
) {
  if (!existing) return true;
  if (item.indexStatus === "pending") return false;
  return (
    existing.indexStatus !== item.indexStatus ||
    existing.indexReason !== item.indexReason ||
    existing.lastVerifiedAt === null ||
    verifiedAt.getTime() - existing.lastVerifiedAt.getTime() >= REVERIFY_AFTER_MS
  );
}

function directoryKey(item: Pick<DirectoryDiscovery, "resourceType" | "externalId">) {
  return `${item.resourceType}:${item.externalId}`;
}

function boundedLimit(limit: number) {
  return Math.min(Math.max(Math.trunc(limit), 1), 1000);
}

export function createMemoryDirectoryRepository(): DirectoryRepository {
  const entries = new Map<string, DirectoryEntry>();
  const syncState = new Map<string, DirectorySyncState>();

  function matchingEntries({
    resourceType,
    indexStatus = "index",
    cursor,
  }: DirectoryQuery): DirectoryEntry[] {
    return [...entries.values()]
      .filter(
        (entry) =>
          entry.resourceType === resourceType &&
          entry.indexStatus === indexStatus &&
          (cursor === undefined || entry.externalId > cursor),
      )
      .sort((left, right) => left.externalId.localeCompare(right.externalId));
  }

  return {
    async recordDiscoveries(items, verifiedAt) {
      for (const item of items) {
        const key = directoryKey(item);
        const existing = entries.get(key);
        if (!needsDirectoryWrite(existing, item, verifiedAt)) continue;
        if (!existing) {
          entries.set(key, {
            ...item,
            firstDiscoveredAt: verifiedAt,
            lastVerifiedAt: item.indexStatus === "pending" ? null : verifiedAt,
          });
        } else {
          Object.assign(existing, {
            discoverySource: item.discoverySource,
            indexStatus: item.indexStatus,
            indexReason: item.indexReason,
            lastVerifiedAt: verifiedAt,
          });
        }
      }
    },
    async listEntries(query) {
      const offset = Math.max(Math.trunc(query.offset ?? 0), 0);
      return matchingEntries(query).slice(offset, offset + boundedLimit(query.limit));
    },
    async listPage(query) {
      const limit = boundedLimit(query.limit);
      const rows = matchingEntries(query).slice(0, limit + 1);
      const pageEntries = rows.slice(0, limit);
      return {
        entries: pageEntries,
        nextCursor: rows.length > limit ? (pageEntries.at(-1)?.externalId ?? null) : null,
      };
    },
    async listStaleEntries({ resourceTypes, verifiedBefore, limit }) {
      const allowed = new Set(resourceTypes);
      return [...entries.values()]
        .filter(
          (entry) =>
            allowed.has(entry.resourceType) &&
            (entry.lastVerifiedAt === null || entry.lastVerifiedAt <= verifiedBefore),
        )
        .sort((left, right) => {
          if (left.lastVerifiedAt === null && right.lastVerifiedAt !== null) return -1;
          if (left.lastVerifiedAt !== null && right.lastVerifiedAt === null) return 1;
          return (
            (left.lastVerifiedAt?.getTime() ?? 0) - (right.lastVerifiedAt?.getTime() ?? 0) ||
            left.resourceType.localeCompare(right.resourceType) ||
            left.externalId.localeCompare(right.externalId)
          );
        })
        .slice(0, boundedLimit(limit));
    },
    async getSyncState(key) {
      return syncState.get(key) ?? null;
    },
    async setSyncState(key, value, updatedAt) {
      syncState.set(key, { value, updatedAt });
    },
    async acquireSyncLease(key, value, acquiredAt, expiresBefore) {
      const existing = syncState.get(key);
      if (existing && existing.updatedAt > expiresBefore) return false;
      syncState.set(key, { value, updatedAt: acquiredAt });
      return true;
    },
  };
}

export function createD1DirectoryRepository(database: D1Database): DirectoryRepository {
  const db = drizzle(database);
  const selection = {
    resourceType: publicEntityDirectory.resourceType,
    externalId: publicEntityDirectory.externalId,
    discoverySource: publicEntityDirectory.discoverySource,
    firstDiscoveredAt: publicEntityDirectory.firstDiscoveredAt,
    lastVerifiedAt: publicEntityDirectory.lastVerifiedAt,
    indexStatus: publicEntityDirectory.indexStatus,
    indexReason: publicEntityDirectory.indexReason,
  };

  async function selectEntries(query: DirectoryQuery, extra = 0) {
    const safeLimit = boundedLimit(query.limit);
    const safeOffset = Math.max(Math.trunc(query.offset ?? 0), 0);
    return db
      .select(selection)
      .from(publicEntityDirectory)
      .where(
        and(
          eq(publicEntityDirectory.resourceType, query.resourceType),
          eq(publicEntityDirectory.indexStatus, query.indexStatus ?? "index"),
          query.cursor === undefined
            ? undefined
            : gt(publicEntityDirectory.externalId, query.cursor),
        ),
      )
      .orderBy(asc(publicEntityDirectory.externalId))
      .limit(safeLimit + extra)
      .offset(query.cursor === undefined ? safeOffset : 0);
  }

  async function selectExistingStates(items: readonly DirectoryDiscovery[]) {
    const idsByType = new Map<DirectoryResourceType, string[]>();
    for (const item of items) {
      idsByType.set(item.resourceType, [
        ...(idsByType.get(item.resourceType) ?? []),
        item.externalId,
      ]);
    }
    const lookups = [...idsByType].flatMap(([resourceType, externalIds]) =>
      Array.from({ length: Math.ceil(externalIds.length / EXISTING_LOOKUP_CHUNK) }, (_, index) =>
        db
          .select({
            resourceType: publicEntityDirectory.resourceType,
            externalId: publicEntityDirectory.externalId,
            indexStatus: publicEntityDirectory.indexStatus,
            indexReason: publicEntityDirectory.indexReason,
            lastVerifiedAt: publicEntityDirectory.lastVerifiedAt,
          })
          .from(publicEntityDirectory)
          .where(
            and(
              eq(publicEntityDirectory.resourceType, resourceType),
              inArray(
                publicEntityDirectory.externalId,
                externalIds.slice(
                  index * EXISTING_LOOKUP_CHUNK,
                  (index + 1) * EXISTING_LOOKUP_CHUNK,
                ),
              ),
            ),
          ),
      ),
    );
    const rows = (await Promise.all(lookups)).flat();
    return new Map(rows.map((row) => [directoryKey(row), row]));
  }

  return {
    async recordDiscoveries(items, verifiedAt) {
      const uniqueItems = [...new Map(items.map((item) => [directoryKey(item), item])).values()];
      if (uniqueItems.length === 0) return;

      const existing = await selectExistingStates(uniqueItems);
      const statements = uniqueItems
        .filter((item) => needsDirectoryWrite(existing.get(directoryKey(item)), item, verifiedAt))
        .map((item) => {
          const values = {
            id: uuidv7(),
            ...item,
            firstDiscoveredAt: verifiedAt,
            lastVerifiedAt: item.indexStatus === "pending" ? null : verifiedAt,
          };

          if (item.indexStatus === "pending") {
            return db
              .insert(publicEntityDirectory)
              .values(values)
              .onConflictDoNothing({
                target: [publicEntityDirectory.resourceType, publicEntityDirectory.externalId],
              });
          }

          return db
            .insert(publicEntityDirectory)
            .values(values)
            .onConflictDoUpdate({
              target: [publicEntityDirectory.resourceType, publicEntityDirectory.externalId],
              set: {
                discoverySource: item.discoverySource,
                lastVerifiedAt: verifiedAt,
                indexStatus: item.indexStatus,
                indexReason: item.indexReason,
              },
            });
        });

      if (statements.length === 0) return;
      for (let index = 0; index < statements.length; index += 100) {
        const batch = statements.slice(index, index + 100);
        await db.batch(batch as [(typeof batch)[number], ...Array<(typeof batch)[number]>]);
      }
    },

    async listEntries(query) {
      return selectEntries(query);
    },

    async listPage(query) {
      const limit = boundedLimit(query.limit);
      const rows = await selectEntries({ ...query, offset: 0 }, 1);
      const entries = rows.slice(0, limit);
      return {
        entries,
        nextCursor: rows.length > limit ? (entries.at(-1)?.externalId ?? null) : null,
      };
    },

    async listStaleEntries({ resourceTypes, verifiedBefore, limit }) {
      if (resourceTypes.length === 0) return [];
      return db
        .select(selection)
        .from(publicEntityDirectory)
        .where(
          and(
            inArray(publicEntityDirectory.resourceType, [...resourceTypes]),
            or(
              isNull(publicEntityDirectory.lastVerifiedAt),
              lt(publicEntityDirectory.lastVerifiedAt, verifiedBefore),
              eq(publicEntityDirectory.lastVerifiedAt, verifiedBefore),
            ),
          ),
        )
        .orderBy(
          asc(publicEntityDirectory.lastVerifiedAt),
          asc(publicEntityDirectory.resourceType),
          asc(publicEntityDirectory.externalId),
        )
        .limit(boundedLimit(limit));
    },

    async getSyncState(key) {
      const rows = await db
        .select({ value: directorySyncState.value, updatedAt: directorySyncState.updatedAt })
        .from(directorySyncState)
        .where(eq(directorySyncState.key, key))
        .limit(1);
      return rows[0] ?? null;
    },

    async setSyncState(key, value, updatedAt) {
      await db.insert(directorySyncState).values({ key, value, updatedAt }).onConflictDoUpdate({
        target: directorySyncState.key,
        set: { value, updatedAt },
      });
    },

    async acquireSyncLease(key, value, acquiredAt, expiresBefore) {
      const rows = await db
        .insert(directorySyncState)
        .values({ key, value, updatedAt: acquiredAt })
        .onConflictDoUpdate({
          target: directorySyncState.key,
          set: { value, updatedAt: acquiredAt },
          setWhere: lte(directorySyncState.updatedAt, expiresBefore),
        })
        .returning({ key: directorySyncState.key });
      return rows.length > 0;
    },
  };
}
