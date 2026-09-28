import { eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";

import type { BroadcastChapter, SubjectBroadcast } from "share";

import { getBangumiChaptersUrl } from "./bangumi-api";
import { normalizeChapterPage } from "./chapter";
import { BANGUMI_USER_AGENT } from "./constants";
import { broadcastSnapshot } from "./db/schema";
import type { UpstreamClient, UpstreamLoadOptions } from "./upstream-client";
import type { UpstreamCachePolicy } from "./upstream-cache";

import type { D1Database } from "@cloudflare/workers-types";

const BROADCAST_PAGE_SIZE = 200;
const BROADCAST_CACHE_POLICY = {
  softTtlSeconds: 6 * 60 * 60,
  hardTtlSeconds: 6 * 60 * 60,
  fallbackTtlSeconds: 14 * 24 * 60 * 60,
} satisfies UpstreamCachePolicy;

const BROADCAST_STALE_AFTER_MS = 6 * 60 * 60 * 1000;
const CONFIRMED_COMPLETE_STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export interface BroadcastSnapshotRecord extends SubjectBroadcast {
  subjectId: number;
  updatedAt: Date;
}

export interface BroadcastRepository {
  get: (subjectId: number) => Promise<BroadcastSnapshotRecord | null>;
  getMany: (subjectIds: number[]) => Promise<BroadcastSnapshotRecord[]>;
  upsert: (snapshot: BroadcastSnapshotRecord) => Promise<void>;
}

function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

function utcDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function previousUtcDate(value: Date): string {
  return utcDate(new Date(value.getTime() - 24 * 60 * 60 * 1000));
}

export function createBroadcastSnapshot(
  subjectId: number,
  chapters: Array<{ type: string; sequence: number | null; date: string | null }>,
  plannedChapters: number | null,
  updatedAt: Date,
): BroadcastSnapshotRecord {
  const seen = new Set<string>();
  const datedChapters = chapters
    .flatMap((chapter): BroadcastChapter[] => {
      if (
        chapter.type !== "本篇" ||
        chapter.sequence === null ||
        !Number.isFinite(chapter.sequence) ||
        chapter.sequence <= 0 ||
        chapter.date === null ||
        !isCalendarDate(chapter.date)
      ) {
        return [];
      }
      const key = `${chapter.sequence}\n${chapter.date}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ sequence: chapter.sequence, date: chapter.date }];
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.sequence - right.sequence);

  let completeAfter: string | null = null;
  if (plannedChapters !== null && Number.isSafeInteger(plannedChapters) && plannedChapters > 0) {
    const datesBySequence = new Map<number, string[]>();
    for (const chapter of datedChapters) {
      if (!Number.isInteger(chapter.sequence)) continue;
      const dates = datesBySequence.get(chapter.sequence) ?? [];
      dates.push(chapter.date);
      datesBySequence.set(chapter.sequence, dates);
    }
    const plannedDates = Array.from({ length: plannedChapters }, (_, index) =>
      datesBySequence
        .get(index + 1)
        ?.toSorted()
        .at(-1),
    );
    if (plannedDates.every((date): date is string => date !== undefined)) {
      completeAfter = plannedDates.toSorted().at(-1) ?? null;
    }
  }

  return { subjectId, chapters: datedChapters, completeAfter, updatedAt };
}

/** Confirmed-complete subjects rarely change upstream, so they are refreshed far less often. */
export function isBroadcastSnapshotStale(
  snapshot: Pick<BroadcastSnapshotRecord, "completeAfter" | "updatedAt"> | null | undefined,
  now: Date,
) {
  if (!snapshot) return true;
  const confirmedComplete =
    snapshot.completeAfter !== null && snapshot.completeAfter < previousUtcDate(now);
  const staleAfter = confirmedComplete
    ? CONFIRMED_COMPLETE_STALE_AFTER_MS
    : BROADCAST_STALE_AFTER_MS;
  return now.getTime() - snapshot.updatedAt.getTime() >= staleAfter;
}

export function toSubjectBroadcast(
  snapshot: BroadcastSnapshotRecord | null,
  now: Date,
): SubjectBroadcast | null {
  if (!snapshot) return null;
  const cutoff = previousUtcDate(now);
  return {
    chapters: snapshot.chapters.filter((chapter) => chapter.date >= cutoff),
    completeAfter: snapshot.completeAfter,
  };
}

export async function fetchBroadcastSnapshot({
  subjectId,
  plannedChapters,
  apiUrl,
  fetch,
  now,
}: {
  subjectId: number;
  plannedChapters: number | null;
  apiUrl?: string;
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  now: Date;
}): Promise<BroadcastSnapshotRecord> {
  const chapters = [];
  let offset = 0;
  let total = Number.POSITIVE_INFINITY;

  while (offset < total) {
    const response = await fetch(
      getBangumiChaptersUrl(subjectId, BROADCAST_PAGE_SIZE, offset, apiUrl),
      { headers: { "User-Agent": BANGUMI_USER_AGENT } },
    );
    if (!response.ok) throw new Error(`Broadcast upstream returned ${response.status}`);
    const page = normalizeChapterPage(await response.json(), BROADCAST_PAGE_SIZE, offset);
    chapters.push(...page.data);
    total = page.total;
    offset += BROADCAST_PAGE_SIZE;
    if (page.total === 0) break;
  }

  return createBroadcastSnapshot(subjectId, chapters, plannedChapters, now);
}

export interface BroadcastSnapshotLoadInput {
  subjectId: number;
  plannedChapters: number | null;
  apiUrl?: string;
  now: Date;
  upstream: Omit<UpstreamLoadOptions, "policy">;
}

export function createBroadcastSnapshotLoader(client: UpstreamClient) {
  return ({ upstream, ...input }: BroadcastSnapshotLoadInput) =>
    fetchBroadcastSnapshot({
      ...input,
      fetch: async (requestInput, init) => {
        const request =
          requestInput instanceof Request ? requestInput : new Request(requestInput, init);
        const loaded = await client.load(request, {
          ...upstream,
          policy: BROADCAST_CACHE_POLICY,
        });
        return loaded.response;
      },
    });
}

export function createD1BroadcastRepository(database: D1Database): BroadcastRepository {
  const db = drizzle(database, { schema: { broadcastSnapshot } });

  function normalize(
    row: typeof broadcastSnapshot.$inferSelect | undefined,
  ): BroadcastSnapshotRecord | null {
    return row
      ? {
          subjectId: row.subjectId,
          chapters: row.chapters,
          completeAfter: row.completeAfter,
          updatedAt: row.updatedAt,
        }
      : null;
  }

  return {
    async get(subjectId) {
      return normalize(
        await db.query.broadcastSnapshot.findFirst({
          where: eq(broadcastSnapshot.subjectId, subjectId),
        }),
      );
    },
    async getMany(subjectIds) {
      if (subjectIds.length === 0) return [];
      const rows = await db.query.broadcastSnapshot.findMany({
        where: inArray(broadcastSnapshot.subjectId, subjectIds),
      });
      return rows.flatMap((row) => {
        const snapshot = normalize(row);
        return snapshot ? [snapshot] : [];
      });
    },
    async upsert(snapshot) {
      await db
        .insert(broadcastSnapshot)
        .values(snapshot)
        .onConflictDoUpdate({
          target: broadcastSnapshot.subjectId,
          set: {
            chapters: snapshot.chapters,
            completeAfter: snapshot.completeAfter,
            updatedAt: snapshot.updatedAt,
          },
        });
    },
  };
}
