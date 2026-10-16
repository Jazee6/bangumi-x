import { afterEach, describe, vi, expect, test } from "vitest";

import { createMemoryDirectoryRepository } from "./directory";
import { createApp } from "./index";
import { REQUEST_MAINTENANCE_MAX_UPSTREAM_CALLS, runRequestMaintenance } from "./maintenance";

const originalCaches = globalThis.caches;

afterEach(() => {
  globalThis.caches = originalCaches;
});

function installMemoryCache() {
  const entries = new Map<string, Response>();
  const key = (request: RequestInfo | URL) =>
    request instanceof Request ? request.url : String(request);
  globalThis.caches = {
    open: async () => ({
      match: async (request: RequestInfo | URL) => entries.get(key(request))?.clone(),
      put: async (request: RequestInfo | URL, response: Response) => {
        entries.set(key(request), response.clone());
      },
      delete: async (request: RequestInfo | URL) => entries.delete(key(request)),
    }),
  } as unknown as CacheStorage;
}

describe("request-driven directory maintenance", () => {
  test("uses an hourly lease and never exceeds the call budget", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-09-13T12:00:00.000Z");
    await directory.recordDiscoveries(
      [
        {
          resourceType: "subject",
          externalId: "42",
          discoverySource: "direct_access",
          indexStatus: "index",
          indexReason: "subject_verified",
        },
      ],
      new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
    );

    const requested: string[] = [];
    const request = vi.fn(async (path: string) => {
      requested.push(path);
      return Response.json({ ok: true });
    });

    const first = await runRequestMaintenance({ directory, now, request });
    expect(first.acquired).toBe(true);
    expect(first.requests).toBeLessThanOrEqual(REQUEST_MAINTENANCE_MAX_UPSTREAM_CALLS);
    expect(requested).toContain("/subjects/42");
    expect(requested.some((path) => path.startsWith("/rankings?"))).toBe(true);

    requested.length = 0;
    const second = await runRequestMaintenance({ directory, now, request });
    expect(second).toEqual({
      acquired: false,
      requests: 0,
      refreshedEntities: 0,
      historicalQuarters: 0,
      seededSubjects: 0,
    });
    expect(requested).toEqual([]);
  });

  test("allows only one concurrent request to acquire the hourly lease", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-09-13T12:00:00.000Z");
    const request = vi.fn(async () => Response.json({ ok: true }));

    const results = await Promise.all([
      runRequestMaintenance({ directory, now, request }),
      runRequestMaintenance({ directory, now, request }),
    ]);

    expect(results.filter((result) => result.acquired)).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1);
  });

  test("caps actual upstream calls from maintenance subrequests", async () => {
    const fetch = vi.fn(async () => Response.json({ total: 0, data: [] }));
    const app = createApp({
      fetch,
      now: () => new Date("2026-09-13T12:00:00.000Z"),
      random: () => 1,
    });

    const bindings = {
      BGM_API_URL: "https://api.example.test",
      WEB_ORIGIN: "https://web.example.test",
    };
    // Each quarter fetches three months, so the second one runs out of budget.
    const first = await app.request(
      "/rankings?year=2025&season=winter&page=1&pageSize=24",
      { headers: { "X-Bangumi-Maintenance": "1" } },
      bindings,
    );
    const second = await app.request(
      "/rankings?year=2024&season=autumn&page=1&pageSize=24",
      { headers: { "X-Bangumi-Maintenance": "1" } },
      bindings,
    );

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(fetch).toHaveBeenCalledTimes(REQUEST_MAINTENANCE_MAX_UPSTREAM_CALLS);
  });

  test("ignores the maintenance header on requests arriving through Cloudflare", async () => {
    const fetch = vi.fn(async () => Response.json({ total: 0, data: [] }));
    const app = createApp({
      fetch,
      now: () => new Date("2026-09-13T12:00:00.000Z"),
      random: () => 1,
    });

    const response = await app.request(
      "/rankings?year=2024&season=spring&page=1&pageSize=24",
      { headers: { "X-Bangumi-Maintenance": "1", "CF-Ray": "external" } },
      { BGM_API_URL: "https://api.example.test", WEB_ORIGIN: "https://web.example.test" },
    );

    expect(response.status).toBe(200);
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  test("keeps the rankings backfill cursor until the quarter succeeds", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-09-13T12:00:00.000Z");
    await directory.setSyncState("rankings:backfill-cursor", "2024/spring", now);
    const lease = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const failing = vi.fn(async () => new Response(null, { status: 429 }));
    await directory.setSyncState("request-maintenance:lease", "done", lease);
    await runRequestMaintenance({ directory, now, request: failing });
    expect((await directory.getSyncState("rankings:backfill-cursor"))?.value).toBe("2024/spring");

    const succeeding = vi.fn(async () => Response.json({ ok: true }));
    await directory.setSyncState("request-maintenance:lease", "done", lease);
    const result = await runRequestMaintenance({ directory, now, request: succeeding });
    expect(result.historicalQuarters).toBe(1);
    expect((await directory.getSyncState("rankings:backfill-cursor"))?.value).toBe("2024/winter");
  });

  test("purges expired records once per lease without blocking directory work", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-09-13T12:00:00.000Z");
    const purgeExpiredRecords = vi.fn(async () => {
      throw new Error("D1 unavailable");
    });
    const request = vi.fn(async () => Response.json({ ok: true }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);

    const first = await runRequestMaintenance({ directory, now, request, purgeExpiredRecords });
    const second = await runRequestMaintenance({ directory, now, request, purgeExpiredRecords });

    expect(first.acquired).toBe(true);
    expect(first.historicalQuarters).toBe(1);
    expect(second.acquired).toBe(false);
    expect(purgeExpiredRecords).toHaveBeenCalledTimes(1);
  });

  test("completes a cold quarter across hourly runs within the upstream budget", async () => {
    installMemoryCache();
    const directory = createMemoryDirectoryRepository();
    let now = new Date("2026-09-13T12:00:00.000Z");
    await directory.setSyncState("rankings:backfill-cursor", "2024/spring", now);
    // Each hour the entity step picks a different cold entity, so it always spends upstream budget.
    await directory.recordDiscoveries(
      ["9", "10", "11"].map((externalId) => ({
        resourceType: "subject" as const,
        externalId,
        discoverySource: "daily_broadcast" as const,
        indexStatus: "pending" as const,
        indexReason: "schedule_unverified",
      })),
      now,
    );
    const fetch = vi.fn(async (input: string | URL | Request) =>
      /\/v0\/subjects\/\d+$/.test(new URL(String(input)).pathname)
        ? new Response(null, { status: 404 })
        : Response.json({ total: 0, data: [] }),
    );
    const app = createApp({ fetch, now: () => now, random: () => 1, directory: () => directory });
    const bindings = {
      BGM_API_URL: "https://api.example.test",
      WEB_ORIGIN: "https://web.example.test",
    };
    const request = async (path: string) =>
      app.request(path, { headers: { "X-Bangumi-Maintenance": "1" } }, bindings);

    const cursors: string[] = [];
    for (let run = 0; run < 3; run += 1) {
      now = new Date(now.getTime() + 61 * 60 * 1000);
      await runRequestMaintenance({ directory, now, request });
      cursors.push((await directory.getSyncState("rankings:backfill-cursor"))?.value ?? "");
    }

    // A cold quarter needs three of the four hourly calls, so it completes within one run.
    expect(cursors[0]).toBe("2024/winter");
    expect(cursors[1]).toBe("2023/autumn");
  });

  test("marks a stale entity unavailable after a confirmed 404", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2027-01-02T00:00:00.000Z");
    await directory.recordDiscoveries(
      [
        {
          resourceType: "subject",
          externalId: "9",
          discoverySource: "direct_access",
          indexStatus: "index",
          indexReason: "subject_verified",
        },
      ],
      new Date("2026-01-01T00:00:00.000Z"),
    );

    const request = vi.fn(async (path: string) =>
      path === "/subjects/9" ? new Response(null, { status: 404 }) : Response.json({ ok: true }),
    );
    const result = await runRequestMaintenance({ directory, now, request });

    expect(result.refreshedEntities).toBe(1);
    const unavailable = await directory.listEntries({
      resourceType: "subject",
      indexStatus: "noindex",
      limit: 10,
      offset: 0,
    });
    expect(unavailable.map((entry) => entry.externalId)).toContain("9");
  });

  test("seeds daily broadcast subjects first and picks up later ones", async () => {
    const directory = createMemoryDirectoryRepository();
    let now = new Date("2026-10-15T00:00:00.000Z");
    const seed = (externalId: string, discoverySource: "daily_broadcast" | "rankings", at: Date) =>
      directory.recordDiscoveries(
        [
          {
            resourceType: "subject",
            externalId,
            discoverySource,
            indexStatus: "index",
            indexReason: "subject_verified",
          },
        ],
        at,
      );
    await seed("1", "rankings", new Date(now.getTime() - 3000));
    await seed("2", "daily_broadcast", new Date(now.getTime() - 2000));
    await seed("3", "daily_broadcast", new Date(now.getTime() - 1000));

    const seeded: string[] = [];
    const request = vi.fn(async (path: string) => {
      const match = /^\/subjects\/(\d+)\/characters$/.exec(path);
      if (match) seeded.push(match[1]!);
      return Response.json({ ok: true });
    });
    const runHour = async () => {
      now = new Date(now.getTime() + 61 * 60 * 1000);
      return runRequestMaintenance({ directory, now, request });
    };

    const first = await runHour();
    expect(first.requests).toBeLessThanOrEqual(REQUEST_MAINTENANCE_MAX_UPSTREAM_CALLS);
    // Daily broadcast goes ahead of the historical backfill.
    expect(request.mock.calls.map(([path]) => path).slice(0, 3)).toEqual([
      "/subjects/2/characters",
      "/subjects/2/persons",
      expect.stringMatching(/^\/rankings\?/),
    ]);
    await seed("4", "daily_broadcast", now);
    await runHour();
    await runHour();
    await runHour();

    expect(seeded).toEqual(["2", "3", "4", "1"]);
  });

  test("keeps the seed cursor when a subject fails to load", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-10-15T00:00:00.000Z");
    await directory.recordDiscoveries(
      [
        {
          resourceType: "subject",
          externalId: "2",
          discoverySource: "daily_broadcast",
          indexStatus: "index",
          indexReason: "subject_verified",
        },
      ],
      now,
    );
    const request = vi.fn(async (path: string) =>
      path.endsWith("/persons") ? new Response(null, { status: 502 }) : Response.json({ ok: true }),
    );

    const result = await runRequestMaintenance({ directory, now, request });

    expect(result.seededSubjects).toBe(0);
    expect(await directory.getSyncState("relations:seed-cursor:daily_broadcast")).toBeNull();
  });

  test("verifies pending seed subjects instead of skipping them", async () => {
    const directory = createMemoryDirectoryRepository();
    let now = new Date("2026-10-15T00:00:00.000Z");
    const batch = new Date(now.getTime() - 1000);
    await directory.recordDiscoveries(
      ["1", "2", "3"].map((externalId) => ({
        resourceType: "subject" as const,
        externalId,
        discoverySource: "daily_broadcast" as const,
        indexStatus: "pending" as const,
        indexReason: "schedule_unverified",
      })),
      batch,
    );
    // A visit verified "2" before maintenance reached the batch.
    await directory.recordDiscoveries(
      [
        {
          resourceType: "subject",
          externalId: "2",
          discoverySource: "daily_broadcast",
          indexStatus: "index",
          indexReason: "subject_verified",
        },
      ],
      batch,
    );

    const seeded: string[] = [];
    const request = vi.fn(async (path: string) => {
      const match = /^\/subjects\/(\d+)\/characters$/.exec(path);
      if (match) seeded.push(match[1]!);
      if (path === "/subjects/3") return Response.json({ title: "R18", nsfw: true });
      if (/^\/subjects\/\d+$/.test(path)) return Response.json({ title: "条目", nsfw: false });
      return Response.json({ ok: true });
    });
    for (let run = 0; run < 3; run += 1) {
      now = new Date(now.getTime() + 61 * 60 * 1000);
      await runRequestMaintenance({ directory, now, request });
    }

    expect(seeded).toEqual(["1", "2"]);
    expect(request).toHaveBeenCalledWith("/subjects/1");
    expect(request).not.toHaveBeenCalledWith("/subjects/2");
    expect(request).not.toHaveBeenCalledWith("/subjects/3/characters");
  });

  test("seeds other sources with the budget left after daily broadcast", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-10-15T00:00:00.000Z");
    await directory.recordDiscoveries(
      [
        { externalId: "1", discoverySource: "daily_broadcast" as const },
        { externalId: "2", discoverySource: "annual_popular" as const },
      ].map((item) => ({
        ...item,
        resourceType: "subject" as const,
        indexStatus: "index" as const,
        indexReason: "subject_verified",
      })),
      now,
    );
    // The backfill quarter is already fresh, so it spends nothing.
    await directory.setSyncState("rankings:backfill-cursor", "2026/winter", now);
    await directory.recordDiscoveries(
      [
        {
          resourceType: "ranking",
          externalId: "2026/winter",
          discoverySource: "rankings",
          indexStatus: "index",
          indexReason: "ranking_verified",
        },
      ],
      now,
    );
    const request = vi.fn(async (_path: string) => Response.json({ ok: true }));

    const result = await runRequestMaintenance({ directory, now, request });

    expect(result.seededSubjects).toBe(2);
    expect(request.mock.calls.map(([path]) => path)).toEqual([
      "/subjects/1/characters",
      "/subjects/1/persons",
      "/subjects/2/characters",
      "/subjects/2/persons",
    ]);
  });
});
