import { afterEach, vi, describe, expect, test } from "vitest";

import { createUpstreamCache, type UpstreamCachePolicy } from "./upstream-cache";

const originalCaches = globalThis.caches;
const policy: UpstreamCachePolicy = {
  softTtlSeconds: 10,
  hardTtlSeconds: 20,
  fallbackTtlSeconds: 30,
  notFoundTtlSeconds: 5,
};

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
  return entries;
}

afterEach(() => {
  globalThis.caches = originalCaches;
});

describe("upstream cache", () => {
  test("bypasses caching when Cache Storage is unavailable", async () => {
    globalThis.caches = undefined as unknown as CacheStorage;
    const now = new Date("2026-01-01T00:00:00.000Z");
    const load = createUpstreamCache(() => now);
    const fetcher = vi.fn(async () => Response.json({ version: 1 }));

    const result = await load(new Request("https://api.example.test/value"), policy, fetcher);

    expect(result.status).toBe("bypass");
    expect(result.fetchedAt).toEqual(now);
    expect(await result.response.json()).toEqual({ version: 1 });
  });

  test("serves a fresh cached response without another upstream call", async () => {
    installMemoryCache();
    let now = new Date("2026-01-01T00:00:00.000Z");
    const load = createUpstreamCache(() => now);
    const fetcher = vi.fn(async () => Response.json({ version: 1 }));
    const request = new Request("https://api.example.test/value");

    const first = await load(request, policy, fetcher);
    now = new Date("2026-01-01T00:00:09.000Z");
    const second = await load(request, policy, fetcher);

    expect(first.status).toBe("miss");
    expect(second.status).toBe("hit");
    expect(second.fetchedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(await second.response.json()).toEqual({ version: 1 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  test("serves stale immediately and refreshes through waitUntil", async () => {
    installMemoryCache();
    let now = new Date("2026-01-01T00:00:00.000Z");
    const load = createUpstreamCache(() => now);
    let version = 1;
    const fetcher = vi.fn(async () => Response.json({ version: version++ }));
    const request = new Request("https://api.example.test/value");
    await load(request, policy, fetcher);

    now = new Date("2026-01-01T00:00:11.000Z");
    let refresh: Promise<unknown> | undefined;
    const stale = await load(request, policy, fetcher, (promise) => {
      refresh = promise;
    });

    expect(stale.status).toBe("stale");
    expect(await stale.response.json()).toEqual({ version: 1 });
    await refresh;
    const refreshed = await load(request, policy, fetcher);
    expect(refreshed.status).toBe("hit");
    expect(await refreshed.response.json()).toEqual({ version: 2 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  test("falls back to the last successful value when hard-expired refresh fails", async () => {
    installMemoryCache();
    let now = new Date("2026-01-01T00:00:00.000Z");
    const load = createUpstreamCache(() => now);
    const request = new Request("https://api.example.test/value");
    await load(request, policy, async () => Response.json({ version: 1 }));

    now = new Date("2026-01-01T00:00:21.000Z");
    const result = await load(request, policy, async () => {
      throw new Error("upstream unavailable");
    });

    expect(result.status).toBe("fallback");
    expect(result.fetchedAt).toEqual(new Date("2026-01-01T00:00:00.000Z"));
    expect(await result.response.json()).toEqual({ version: 1 });
  });

  test("deduplicates concurrent cache misses", async () => {
    const entries = new Map<string, Response>();
    const key = (request: RequestInfo | URL) =>
      request instanceof Request ? request.url : String(request);
    let releaseMatch: (() => void) | undefined;
    const matchGate = new Promise<void>((resolve) => {
      releaseMatch = resolve;
    });
    let matchCalls = 0;
    globalThis.caches = {
      open: async () => ({
        match: async (request: RequestInfo | URL) => {
          matchCalls += 1;
          if (matchCalls > 1) await matchGate;
          return entries.get(key(request))?.clone();
        },
        put: async (request: RequestInfo | URL, response: Response) => {
          entries.set(key(request), response.clone());
        },
        delete: async (request: RequestInfo | URL) => entries.delete(key(request)),
      }),
    } as unknown as CacheStorage;

    const now = new Date("2026-01-01T00:00:00.000Z");
    const load = createUpstreamCache(() => now);
    const request = new Request("https://api.example.test/value");
    let resolveFetch!: (response: Response) => void;
    let signalStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      signalStarted = resolve;
    });
    const fetcher = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
          signalStarted();
        }),
    );

    const first = load(request, policy, fetcher);
    const second = load(request, policy, fetcher);
    await started;
    resolveFetch(Response.json({ version: 1 }));
    await first;
    releaseMatch?.();
    const results = await Promise.all([first, second]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(results.map((result) => result.status).sort()).toEqual(["hit", "miss"]);
    expect(await results[0].response.json()).toEqual({ version: 1 });
    expect(await results[1].response.json()).toEqual({ version: 1 });
  });

  test("caches confirmed 404 responses only for the short negative TTL", async () => {
    installMemoryCache();
    let now = new Date("2026-01-01T00:00:00.000Z");
    const load = createUpstreamCache(() => now);
    const request = new Request("https://api.example.test/missing");
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));

    await load(request, policy, fetcher);
    now = new Date("2026-01-01T00:00:04.000Z");
    expect((await load(request, policy, fetcher)).status).toBe("hit");
    now = new Date("2026-01-01T00:00:06.000Z");
    expect((await load(request, policy, fetcher)).status).toBe("miss");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
