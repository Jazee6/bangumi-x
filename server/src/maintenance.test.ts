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
  test("uses an hourly lease and never exceeds the two-call budget", async () => {
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

    const response = await app.request(
      "/rankings?year=2025&season=winter&page=1&pageSize=24",
      { headers: { "X-Bangumi-Maintenance": "1" } },
      { BGM_API_URL: "https://api.example.test", WEB_ORIGIN: "https://web.example.test" },
    );

    expect(response.status).toBe(429);
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
        resourceType: "chapter" as const,
        externalId,
        discoverySource: "relation" as const,
        indexStatus: "pending" as const,
        indexReason: "chapter_unverified",
      })),
      now,
    );
    const fetch = vi.fn(async (input: string | URL | Request) =>
      String(input).includes("/v0/episodes/")
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

    expect(cursors[0]).toBe("2024/spring");
    expect(cursors[1]).toBe("2024/winter");
  });

  test("marks a stale entity unavailable after a confirmed 404", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2027-01-02T00:00:00.000Z");
    await directory.recordDiscoveries(
      [
        {
          resourceType: "chapter",
          externalId: "9",
          discoverySource: "direct_access",
          indexStatus: "index",
          indexReason: "chapter_verified",
        },
      ],
      new Date("2026-01-01T00:00:00.000Z"),
    );

    const request = vi.fn(async (path: string) =>
      path === "/chapters/9" ? new Response(null, { status: 404 }) : Response.json({ ok: true }),
    );
    const result = await runRequestMaintenance({ directory, now, request });

    expect(result.refreshedEntities).toBe(1);
    const unavailable = await directory.listEntries({
      resourceType: "chapter",
      indexStatus: "noindex",
      limit: 10,
      offset: 0,
    });
    expect(unavailable.map((entry) => entry.externalId)).toContain("9");
  });
});
