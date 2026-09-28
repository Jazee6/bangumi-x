import { createExecutionContext } from "cloudflare:test";
import { afterEach, describe, expect, test, vi } from "vitest";

import { createMemoryDirectoryRepository } from "./directory";
import { createApp } from "./index";

const bindings = {
  BGM_API_URL: "https://api.example.test",
  WEB_ORIGIN: "https://web.example.test",
};
const originalCaches = globalThis.caches;

afterEach(() => {
  globalThis.caches = originalCaches;
});

describe("SEO discovery HTTP side effects", () => {
  test("schedule returns a real fetch time and seeds pending subjects", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-09-07T01:02:03.000Z");
    const app = createApp({
      now: () => now,
      directory: () => directory,
      fetch: vi.fn(async () =>
        Response.json([{ weekday: { id: 1 }, items: [{ id: 42, name_cn: "测试动画" }] }]),
      ),
    });

    const response = await app.request("/schedule", {}, bindings);
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ fetchedAt: now.toISOString() });
    expect(
      await directory.listEntries({
        resourceType: "subject",
        indexStatus: "pending",
        limit: 10,
        offset: 0,
      }),
    ).toHaveLength(1);
  });

  test("reuses cached schedule JSON and preserves its original fetchedAt", async () => {
    const directory = createMemoryDirectoryRepository();
    const cache = new Map<string, Response>();
    const cacheKey = (request: RequestInfo | URL) =>
      request instanceof Request ? request.url : String(request);
    globalThis.caches = {
      open: async () => ({
        match: async (request: RequestInfo | URL) => cache.get(cacheKey(request)),
        put: async (request: RequestInfo | URL, response: Response) => {
          cache.set(cacheKey(request), response.clone());
        },
        delete: async (request: RequestInfo | URL) => cache.delete(cacheKey(request)),
      }),
    } as unknown as CacheStorage;
    const currentTime = new Date("2026-09-01T01:02:03.000Z");
    const app = createApp({
      now: () => currentTime,
      directory: () => directory,
      fetch: vi.fn(async () =>
        Response.json([{ weekday: { id: 1 }, items: [{ id: 42, name_cn: "测试动画" }] }]),
      ),
    });

    const first = await app.request("/schedule", {}, bindings);
    const second = await app.request("/schedule", {}, bindings);
    expect((await first.json()).fetchedAt).toBe("2026-09-01T01:02:03.000Z");
    expect((await second.json()).fetchedAt).toBe("2026-09-01T01:02:03.000Z");
    expect(
      await directory.listEntries({
        resourceType: "subject",
        indexStatus: "pending",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([expect.objectContaining({ lastVerifiedAt: null })]);
  });

  test("annual popular promotes ranked subjects while keyword search does not", async () => {
    const directory = createMemoryDirectoryRepository();
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const popular = !url.pathname.includes("search");
      return Response.json({
        total: 3,
        data: popular
          ? [
              { id: 42, name_cn: "测试动画", type: 2, nsfw: false, rating: { rank: 12, score: 8 } },
              { id: 43, name_cn: "成人动画", type: 2, nsfw: true, rating: { rank: 13, score: 8 } },
              {
                id: 44,
                name_cn: "无排名动画",
                type: 2,
                nsfw: false,
                rating: { rank: 0, score: 8 },
              },
            ]
          : [{ id: 99, name_cn: "搜索结果", type: 2, nsfw: false, rating: { rank: 1, score: 8 } }],
      });
    });
    const app = createApp({ fetch, directory: () => directory, now: () => new Date("2026-01-01") });

    await app.request("/discover/popular?type=anime&year=2026&page=1&pageSize=24", {}, bindings);
    await app.request(
      "/discover/search/subjects?type=anime&keyword=test&page=1&pageSize=24",
      {},
      bindings,
    );

    const entries = await directory.listEntries({
      resourceType: "subject",
      indexStatus: "index",
      limit: 10,
      offset: 0,
    });
    expect(entries.map((entry) => entry.externalId)).toEqual(["42"]);
    expect(
      await directory.listEntries({
        resourceType: "subject",
        indexStatus: "index",
        limit: 10,
        offset: 0,
      }),
    ).not.toEqual(expect.arrayContaining([expect.objectContaining({ externalId: "43" })]));
  });

  test("rankings returns real fetchedAt and indexes qualified anime without future quarters", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-02-15T08:00:00.000Z");
    const fetch = vi.fn(async () =>
      Response.json({
        data: [
          { id: 101, name_cn: "榜首动画", type: 2, nsfw: false, rating: { rank: 1, score: 9 } },
          { id: 102, name_cn: "成人动画", type: 2, nsfw: true, rating: { rank: 2, score: 8.5 } },
          { id: 103, name_cn: "未命名条目", type: 2, nsfw: false, rating: { rank: 3, score: 8.0 } },
        ],
      }),
    );
    const app = createApp({ fetch, directory: () => directory, now: () => now });

    const response = await app.request(
      "/rankings?year=2026&season=winter&page=1&pageSize=24",
      {},
      bindings,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fetchedAt).toBe(now.toISOString());
    expect(body.data[0].id).toBe(101);

    const entries = await directory.listEntries({
      resourceType: "subject",
      indexStatus: "index",
      limit: 10,
      offset: 0,
    });
    expect(entries.map((entry) => entry.externalId)).toEqual(["101"]);
    expect(entries[0].discoverySource).toBe("rankings");

    const rankingEntries = await directory.listEntries({
      resourceType: "ranking",
      indexStatus: "index",
      limit: 10,
      offset: 0,
    });
    expect(rankingEntries).toEqual([
      expect.objectContaining({
        resourceType: "ranking",
        externalId: "2026/winter",
        discoverySource: "rankings",
        indexStatus: "index",
        indexReason: "rankings_qualified",
      }),
    ]);
  });

  test("empty rankings returns 200 without recording indexed directory entries", async () => {
    const directory = createMemoryDirectoryRepository();
    const fetch = vi.fn(async () => Response.json({ data: [] }));
    const app = createApp({ fetch, directory: () => directory, now: () => new Date("2026-01-01") });

    const response = await app.request(
      "/rankings?year=2026&season=winter&page=1&pageSize=24",
      {},
      bindings,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.total).toBe(0);
    expect(body.data).toHaveLength(0);

    const subjectEntries = await directory.listEntries({
      resourceType: "subject",
      indexStatus: "index",
      limit: 10,
      offset: 0,
    });
    expect(subjectEntries).toHaveLength(0);

    const indexedRankings = await directory.listEntries({
      resourceType: "ranking",
      indexStatus: "index",
      limit: 10,
      offset: 0,
    });
    expect(indexedRankings).toHaveLength(0);

    const noindexRankings = await directory.listEntries({
      resourceType: "ranking",
      indexStatus: "noindex",
      limit: 10,
      offset: 0,
    });
    expect(noindexRankings).toEqual([
      expect.objectContaining({
        resourceType: "ranking",
        externalId: "2026/winter",
        discoverySource: "rankings",
        indexStatus: "noindex",
        indexReason: "empty_rankings",
      }),
    ]);
  });

  test("subject detail records indexable subject and exposes scoreCount and fetchedAt", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-03-01T12:00:00.000Z");
    const fetch = vi.fn(async () =>
      Response.json({
        id: 42,
        name_cn: "星际牛仔",
        type: 2,
        nsfw: false,
        rating: { score: 9.1, rank: 10, total: 12000 },
      }),
    );
    const app = createApp({ fetch, directory: () => directory, now: () => now });

    const response = await app.request("/subjects/42", {}, bindings);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.scoreCount).toBe(12000);
    expect(body.fetchedAt).toBe(now.toISOString());

    const entries = await directory.listEntries({
      resourceType: "subject",
      indexStatus: "index",
      limit: 10,
      offset: 0,
    });
    expect(entries).toEqual([
      expect.objectContaining({
        externalId: "42",
        discoverySource: "direct_access",
        indexStatus: "index",
        indexReason: "subject_verified",
      }),
    ]);
  });

  test("NSFW subject is marked noindex in directory", async () => {
    const directory = createMemoryDirectoryRepository();
    const fetch = vi.fn(async () =>
      Response.json({
        id: 69,
        name_cn: "成人条目",
        type: 2,
        nsfw: true,
      }),
    );
    const app = createApp({ fetch, directory: () => directory, now: () => new Date("2026-03-01") });

    const response = await app.request("/subjects/69", {}, bindings);
    expect(response.status).toBe(200);

    const entries = await directory.listEntries({
      resourceType: "subject",
      indexStatus: "noindex",
      limit: 10,
      offset: 0,
    });
    expect(entries).toEqual([
      expect.objectContaining({
        externalId: "69",
        indexStatus: "noindex",
        indexReason: "nsfw",
      }),
    ]);
  });

  test("a confirmed entity 404 withdraws its existing directory entry", async () => {
    const directory = createMemoryDirectoryRepository();
    const first = new Date("2026-03-01T00:00:00.000Z");
    const removedAt = new Date("2026-03-02T00:00:00.000Z");
    await directory.recordDiscoveries(
      [
        {
          resourceType: "person",
          externalId: "404",
          discoverySource: "direct_access",
          indexStatus: "index",
          indexReason: "person_verified",
        },
      ],
      first,
    );
    const app = createApp({
      directory: () => directory,
      now: () => removedAt,
      fetch: vi.fn(async () => new Response(null, { status: 404 })),
    });

    expect((await app.request("/persons/404", {}, bindings)).status).toBe(404);
    expect(
      await directory.listEntries({
        resourceType: "person",
        indexStatus: "noindex",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([
      expect.objectContaining({
        externalId: "404",
        indexReason: "not_found",
        lastVerifiedAt: removedAt,
      }),
    ]);
  });

  test("subject chapters relation discovers pending chapters", async () => {
    const directory = createMemoryDirectoryRepository();
    const fetch = vi.fn(async () =>
      Response.json({
        total: 1,
        limit: 50,
        offset: 0,
        data: [{ id: 1001, type: 0, sort: 1, name_cn: "第一话" }],
      }),
    );
    const app = createApp({ fetch, directory: () => directory, now: () => new Date("2026-03-01") });

    const response = await app.request("/subjects/42/chapters", {}, bindings);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.fetchedAt).toBeDefined();

    const entries = await directory.listEntries({
      resourceType: "chapter",
      indexStatus: "pending",
      limit: 10,
      offset: 0,
    });
    expect(entries).toEqual([
      expect.objectContaining({
        externalId: "1001",
        discoverySource: "relation",
        indexStatus: "pending",
      }),
    ]);
  });

  test("character and person detail quality plus relations update the directory", async () => {
    const directory = createMemoryDirectoryRepository();
    const now = new Date("2026-03-01T12:00:00.000Z");
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname;
      if (path.endsWith("/characters/201")) {
        return Response.json({ id: 201, name: "斯派克", type: 1, summary: "赏金猎人" });
      }
      if (path.endsWith("/characters/201/subjects")) {
        return Response.json([
          { id: 42, name_cn: "星际牛仔", type: 2, staff: "主角" },
          { id: 42, name_cn: "星际牛仔", type: 2, staff: "主角" },
        ]);
      }
      if (path.endsWith("/characters/201/persons")) {
        return Response.json([
          {
            id: 301,
            name: "山寺宏一",
            type: 1,
            staff: "配音",
            subject_id: 42,
            subject_name: "星际牛仔",
            subject_type: 2,
          },
        ]);
      }
      if (path.endsWith("/persons/302")) {
        return Response.json({ id: 302, name: "日升", type: 2, summary: "动画制作公司" });
      }
      if (path.endsWith("/persons/302/subjects")) {
        return Response.json([{ id: 42, name_cn: "星际牛仔", type: 2, staff: "制作" }]);
      }
      if (path.endsWith("/persons/302/characters")) {
        return Response.json([
          {
            id: 202,
            name: "高达",
            type: 2,
            staff: "设计",
            subject_id: 42,
            subject_name: "星际牛仔",
            subject_type: 2,
          },
        ]);
      }
      throw new Error(`Unexpected request: ${path}`);
    });
    const app = createApp({ fetch, directory: () => directory, now: () => now });

    for (const path of [
      "/characters/201",
      "/characters/201/subjects",
      "/characters/201/persons",
      "/persons/302",
      "/persons/302/subjects",
      "/persons/302/characters",
    ]) {
      const response = await app.request(path, {}, bindings);
      expect(response.status).toBe(200);
      expect((await response.json()).fetchedAt).toBe(now.toISOString());
    }

    expect(
      await directory.listEntries({
        resourceType: "character",
        indexStatus: "index",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([expect.objectContaining({ externalId: "201", indexReason: "character_verified" })]);
    expect(
      await directory.listEntries({
        resourceType: "person",
        indexStatus: "index",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([expect.objectContaining({ externalId: "302", indexReason: "person_verified" })]);
    expect(
      await directory.listEntries({
        resourceType: "subject",
        indexStatus: "pending",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([expect.objectContaining({ externalId: "42", discoverySource: "relation" })]);
  });

  test("entity detail records unnamed and thin publication reasons", async () => {
    const directory = createMemoryDirectoryRepository();
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const path = new URL(input instanceof Request ? input.url : input).pathname;
      if (path.endsWith("/characters/203")) {
        return Response.json({ id: 203, type: 1 });
      }
      if (path.endsWith("/characters/203/subjects")) return Response.json([]);
      if (path.endsWith("/persons/303")) {
        return Response.json({ id: 303, name: "薄人物", type: 1 });
      }
      if (path.endsWith("/persons/303/subjects")) return Response.json([]);
      throw new Error(`Unexpected request: ${path}`);
    });
    const app = createApp({ fetch, directory: () => directory, now: () => new Date("2026-03-01") });

    expect((await app.request("/characters/203", {}, bindings)).status).toBe(200);
    expect((await app.request("/persons/303", {}, bindings)).status).toBe(200);

    expect(
      await directory.listEntries({
        resourceType: "character",
        indexStatus: "noindex",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([expect.objectContaining({ externalId: "203", indexReason: "unnamed" })]);
    expect(
      await directory.listEntries({
        resourceType: "person",
        indexStatus: "noindex",
        limit: 10,
        offset: 0,
      }),
    ).toEqual([expect.objectContaining({ externalId: "303", indexReason: "thin_person" })]);
  });

  test("chapter details indexes qualified chapter and flags thin chapter", async () => {
    const directory = createMemoryDirectoryRepository();
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.includes("/episodes/101")) {
        return Response.json({
          id: 101,
          subject_id: 42,
          type: 0,
          name_cn: "有简介章节",
          desc: "这一话非常精彩",
        });
      }
      if (url.pathname.includes("/episodes/102")) {
        return Response.json({
          id: 102,
          subject_id: 42,
          type: 0,
          name_cn: "薄章节",
        });
      }
      return Response.json({ id: 42, name_cn: "父条目", type: 2, nsfw: false });
    });
    const app = createApp({ fetch, directory: () => directory, now: () => new Date("2026-03-01") });

    await app.request("/chapters/101", {}, bindings);
    await app.request("/chapters/102", {}, bindings);

    const indexed = await directory.listEntries({
      resourceType: "chapter",
      indexStatus: "index",
      limit: 10,
      offset: 0,
    });
    expect(indexed.map((e) => e.externalId)).toEqual(["101"]);

    const noindexed = await directory.listEntries({
      resourceType: "chapter",
      indexStatus: "noindex",
      limit: 10,
      offset: 0,
    });
    expect(noindexed.map((e) => e.externalId)).toEqual(["102"]);
  });

  describe("GET /directory HTTP endpoint", () => {
    test("returns paged directory entries with proper cache control and cursor", async () => {
      const directory = createMemoryDirectoryRepository();
      const verifiedAt = new Date("2026-03-15T10:00:00.000Z");
      await directory.recordDiscoveries(
        [
          {
            resourceType: "subject",
            externalId: "1001",
            discoverySource: "daily_broadcast",
            indexStatus: "index",
            indexReason: "verified",
          },
          {
            resourceType: "subject",
            externalId: "1002",
            discoverySource: "daily_broadcast",
            indexStatus: "index",
            indexReason: "verified",
          },
          {
            resourceType: "subject",
            externalId: "1003",
            discoverySource: "daily_broadcast",
            indexStatus: "noindex",
            indexReason: "nsfw",
          },
        ],
        verifiedAt,
      );

      const app = createApp({ directory: () => directory, now: () => verifiedAt });
      const context = createExecutionContext();
      const response = await app.request(
        "/directory?type=subject&status=index&limit=1",
        {},
        bindings,
        context,
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=3600, stale-while-revalidate=86400",
      );
      const data = await response.json();
      expect(data).toEqual({
        resourceType: "subject",
        entries: [
          {
            externalId: "1001",
            lastVerifiedAt: verifiedAt.toISOString(),
            firstDiscoveredAt: verifiedAt.toISOString(),
          },
        ],
        nextCursor: "1001",
      });

      // Fetch page 2 using cursor
      const nextResponse = await app.request(
        "/directory?type=subject&status=index&limit=1&cursor=1001",
        {},
        bindings,
        createExecutionContext(),
      );
      expect(nextResponse.status).toBe(200);
      const nextData = await nextResponse.json();
      expect(nextData.entries).toHaveLength(1);
      expect(nextData.entries[0].externalId).toBe("1002");
      expect(nextData.nextCursor).toBeNull();
    });

    test("rejects invalid directory query parameters with 400", async () => {
      const app = createApp({});
      const noTypeResponse = await app.request("/directory", {}, bindings);
      expect(noTypeResponse.status).toBe(400);
      expect((await noTypeResponse.json()).code).toBe("INVALID_DIRECTORY_QUERY");

      const invalidTypeResponse = await app.request("/directory?type=invalid", {}, bindings);
      expect(invalidTypeResponse.status).toBe(400);
      expect((await invalidTypeResponse.json()).code).toBe("INVALID_DIRECTORY_QUERY");
    });
  });
});
