import {
  isIndexableSubject,
  RANKINGS_MIN_YEAR,
  RANKINGS_PAGE_SIZE,
  SEASON_VALUES,
  getCurrentSeason,
  getCurrentYear,
} from "share";
import type { DirectoryDiscoverySource, DirectoryResourceType, Season } from "share";

import type { DirectoryEntry, DirectoryRepository, SeedSubjectCursor } from "./directory";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const ENTITY_TTL_MS = 7 * DAY_MS;
const HISTORICAL_RANKING_TTL_MS = 30 * DAY_MS;
const LEASE_KEY = "request-maintenance:lease";

export const REQUEST_MAINTENANCE_SAMPLE_RATE = 0.01;
export const MAINTENANCE_HEADER = "X-Bangumi-Maintenance";
export const REQUEST_MAINTENANCE_MAX_UPSTREAM_CALLS = 4;
// Each seeded subject costs two requests and writes about 25 rows, which bounds daily D1 writes.
const MAX_SEEDED_SUBJECTS_PER_RUN = 2;
const SEED_SOURCES = [
  "daily_broadcast",
  "annual_popular",
  "rankings",
] as const satisfies readonly DirectoryDiscoverySource[];

const ENTITY_RESOURCE_TYPES = [
  "subject",
  "character",
  "person",
] as const satisfies readonly DirectoryResourceType[];

export interface RequestMaintenanceRuntime {
  directory: DirectoryRepository;
  now: Date;
  request(path: string): Promise<Response>;
  purgeExpiredRecords?: () => Promise<void>;
}

export interface RequestMaintenanceResult {
  acquired: boolean;
  requests: number;
  refreshedEntities: number;
  historicalQuarters: number;
  seededSubjects: number;
}

/** Maintenance subrequests are dispatched in-process, so they never carry Cloudflare's CF-Ray. */
export function isMaintenanceRequest(header: (name: string) => string | undefined) {
  return header(MAINTENANCE_HEADER) === "1" && !header("CF-Ray");
}

function isDue(updatedAt: Date | undefined, now: Date, ttl: number) {
  return !updatedAt || updatedAt.getTime() <= now.getTime() - ttl;
}

function rankingPath(year: number, season: Season) {
  return `/rankings?year=${year}&season=${season}&page=1&pageSize=${RANKINGS_PAGE_SIZE}`;
}

function previousQuarter(year: number, season: Season): { year: number; season: Season } {
  const index = SEASON_VALUES.indexOf(season);
  return index === 0
    ? { year: year - 1, season: "autumn" }
    : { year, season: SEASON_VALUES[index - 1]! };
}

function parseQuarter(value: string | undefined): { year: number; season: Season } | null {
  if (!value) return null;
  const [yearValue, seasonValue] = value.split("/");
  const year = Number(yearValue);
  return Number.isInteger(year) && SEASON_VALUES.includes(seasonValue as Season)
    ? { year, season: seasonValue as Season }
    : null;
}

function entityPath(entry: DirectoryEntry) {
  switch (entry.resourceType) {
    case "subject":
      return `/subjects/${entry.externalId}`;
    case "character":
      return `/characters/${entry.externalId}`;
    case "person":
      return `/persons/${entry.externalId}`;
    default:
      return null;
  }
}

function seedCursorKey(source: DirectoryDiscoverySource) {
  return `relations:seed-cursor:${source}`;
}

function formatSeedCursor(cursor: SeedSubjectCursor) {
  return `${cursor.firstDiscoveredAt.getTime()}/${cursor.externalId}`;
}

function parseSeedCursor(value: string | undefined): SeedSubjectCursor | null {
  if (!value) return null;
  const [time, externalId] = value.split("/");
  const firstDiscoveredAt = new Date(Number(time));
  return externalId && Number.isFinite(firstDiscoveredAt.getTime())
    ? { firstDiscoveredAt, externalId }
    : null;
}

async function findRanking(
  directory: DirectoryRepository,
  externalId: string,
): Promise<DirectoryEntry | undefined> {
  for (const indexStatus of ["index", "noindex"] as const) {
    const entries = await directory.listEntries({
      resourceType: "ranking",
      indexStatus,
      limit: 1000,
      offset: 0,
    });
    const match = entries.find((entry) => entry.externalId === externalId);
    if (match) return match;
  }
  return undefined;
}

export async function runRequestMaintenance({
  directory,
  now,
  request,
  purgeExpiredRecords,
}: RequestMaintenanceRuntime): Promise<RequestMaintenanceResult> {
  const acquired = await directory.acquireSyncLease(
    LEASE_KEY,
    "running",
    now,
    new Date(now.getTime() - HOUR_MS),
  );
  if (!acquired) {
    return {
      acquired: false,
      requests: 0,
      refreshedEntities: 0,
      historicalQuarters: 0,
      seededSubjects: 0,
    };
  }
  try {
    await purgeExpiredRecords?.();
  } catch (error) {
    console.error("Expired record purge failed", error);
  }

  let requests = 0;
  let refreshedEntities = 0;
  let historicalQuarters = 0;

  async function run(path: string) {
    if (requests >= REQUEST_MAINTENANCE_MAX_UPSTREAM_CALLS) {
      return new Response(null, { status: 429 });
    }
    requests += 1;
    try {
      return await request(path);
    } catch {
      return new Response(null, { status: 502 });
    }
  }

  // Seeding keeps one cursor per source in first-discovery order, so subjects joining later (a new
  // season's daily broadcast) always sort after it. A pending subject is verified first, since its
  // batch shares one discovery time and the cursor must not pass it unverified. A failed subject
  // stops seeding for this run and is retried next hour; one gone upstream or not indexable is
  // skipped. See ADR 0015.
  let seededSubjects = 0;
  let seedingStopped = false;
  const drainedSources = new Set<DirectoryDiscoverySource>();

  // Returns whether the subject is settled, so the cursor may move past it.
  async function seedSubject(subject: DirectoryEntry): Promise<boolean> {
    const id = subject.externalId;
    if (subject.indexStatus === "pending") {
      const response = await run(`/subjects/${id}`);
      if (response.status === 404) return true;
      if (!response.ok) return false;
      // Read the decision from the response: the directory write it triggers is deferred.
      const detail = (await response.json().catch(() => null)) as {
        title?: string;
        nsfw?: boolean;
      } | null;
      if (!detail || typeof detail.nsfw !== "boolean") return false;
      if (!isIndexableSubject({ nsfw: detail.nsfw, title: detail.title })) return true;
    }
    const responses = [
      await run(`/subjects/${id}/characters`),
      await run(`/subjects/${id}/persons`),
    ];
    if (responses.some((response) => !response.ok && response.status !== 404)) return false;
    seededSubjects += 1;
    return true;
  }

  async function seed(sources: readonly DirectoryDiscoverySource[], maxSubjects: number) {
    for (const source of sources) {
      const limit = maxSubjects - seededSubjects;
      if (seedingStopped || limit <= 0) return;
      if (drainedSources.has(source)) continue;
      const subjects = await directory.listSeedSubjects({
        discoverySource: source,
        after: parseSeedCursor((await directory.getSyncState(seedCursorKey(source)))?.value),
        limit,
      });
      if (subjects.length < limit) drainedSources.add(source);
      for (const subject of subjects) {
        const cost = subject.indexStatus === "pending" ? 3 : 2;
        if (
          seededSubjects >= maxSubjects ||
          requests + cost > REQUEST_MAINTENANCE_MAX_UPSTREAM_CALLS
        ) {
          return;
        }
        if (!(await seedSubject(subject))) {
          seedingStopped = true;
          return;
        }
        await directory.setSyncState(seedCursorKey(source), formatSeedCursor(subject), now);
      }
    }
  }

  // The current season's characters and voice actors draw the most searches, so one daily
  // broadcast subject goes first; historical backfill waits until that queue is drained.
  await seed(["daily_broadcast"], 1);

  // Backfill runs next because a quarter needs all of its months; entities use what remains.
  const current = { year: getCurrentYear(now), season: getCurrentSeason(now) };
  const cursorState = await directory.getSyncState("rankings:backfill-cursor");
  let target = parseQuarter(cursorState?.value) ?? previousQuarter(current.year, current.season);
  if (target.year < RANKINGS_MIN_YEAR) target = previousQuarter(current.year, current.season);

  const existingRanking = await findRanking(directory, `${target.year}/${target.season}`);
  let settled = true;
  if (
    !existingRanking?.lastVerifiedAt ||
    isDue(existingRanking.lastVerifiedAt, now, HISTORICAL_RANKING_TTL_MS)
  ) {
    const response = await run(rankingPath(target.year, target.season));
    settled = response.ok;
    if (response.ok) historicalQuarters = 1;
  }
  // A failed quarter keeps the cursor; months fetched so far stay cached for the next run.
  if (settled) {
    const next = previousQuarter(target.year, target.season);
    await directory.setSyncState("rankings:backfill-cursor", `${next.year}/${next.season}`, now);
  }

  const [entry] =
    requests < REQUEST_MAINTENANCE_MAX_UPSTREAM_CALLS
      ? await directory.listStaleEntries({
          resourceTypes: ENTITY_RESOURCE_TYPES,
          verifiedBefore: new Date(now.getTime() - ENTITY_TTL_MS),
          limit: 1,
        })
      : [];
  if (entry) {
    const path = entityPath(entry);
    if (path) {
      const response = await run(path);
      if (response.status === 404) {
        await directory.recordDiscoveries(
          [
            {
              resourceType: entry.resourceType,
              externalId: entry.externalId,
              discoverySource: entry.discoverySource,
              indexStatus: "noindex",
              indexReason: "not_found",
            },
          ],
          now,
          { reverify: true },
        );
      }
      if (response.ok || response.status === 404) refreshedEntities = 1;
    }
  }

  // The rest of the budget seeds other sources once backfill and refresh are done.
  await seed(SEED_SOURCES, MAX_SEEDED_SUBJECTS_PER_RUN);

  await directory.setSyncState(LEASE_KEY, "done", now);
  return { acquired: true, requests, refreshedEntities, historicalQuarters, seededSubjects };
}
