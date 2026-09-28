import { afterEach, describe, expect, test } from "vitest";

import {
  createBroadcastSnapshot,
  createBroadcastSnapshotLoader,
  fetchBroadcastSnapshot,
  isBroadcastSnapshotStale,
  toSubjectBroadcast,
} from "./broadcast";
import { createUpstreamClient } from "./upstream-client";

const now = new Date("2026-09-19T12:00:00.000Z");
const originalCaches = globalThis.caches;

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

afterEach(() => {
  globalThis.caches = originalCaches;
});

describe("createBroadcastSnapshot", () => {
  test("keeps dated main chapters and confirms a complete planned run", () => {
    const snapshot = createBroadcastSnapshot(
      42,
      [
        { type: "本篇", sequence: 1, date: "2026-09-01" },
        { type: "本篇", sequence: 2, date: "2026-09-08" },
        { type: "本篇", sequence: 3, date: "2026-09-20" },
        { type: "特别篇", sequence: 1, date: "2026-09-21" },
        { type: "本篇", sequence: 4, date: "invalid" },
      ],
      3,
      now,
    );

    expect(snapshot.chapters).toEqual([
      { sequence: 1, date: "2026-09-01" },
      { sequence: 2, date: "2026-09-08" },
      { sequence: 3, date: "2026-09-20" },
    ]);
    expect(snapshot.completeAfter).toBe("2026-09-20");
  });

  test("does not confirm completion when a planned chapter lacks a valid date", () => {
    const snapshot = createBroadcastSnapshot(
      42,
      [
        { type: "本篇", sequence: 1, date: "2026-09-01" },
        { type: "本篇", sequence: 3, date: "2026-09-20" },
      ],
      3,
      now,
    );

    expect(snapshot.completeAfter).toBeNull();
  });
});

describe("fetchBroadcastSnapshot", () => {
  test("requests every main-chapter page and preserves strict completion evidence", async () => {
    const urls: URL[] = [];
    const fetch = async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      urls.push(url);
      if (url.searchParams.has("type")) return new Response(null, { status: 502 });
      const offset = Number(url.searchParams.get("offset"));
      const start = offset + 1;
      const count = offset === 0 ? 200 : 1;
      return Response.json({
        total: 201,
        data: Array.from({ length: count }, (_, index) => ({
          id: start + index,
          type: 0,
          sort: start + index,
          airdate: `2026-09-${String((start + index) % 28 || 28).padStart(2, "0")}`,
        })),
      });
    };

    const snapshot = await fetchBroadcastSnapshot({
      subjectId: 42,
      plannedChapters: 201,
      fetch,
      now,
    });

    expect(urls).toHaveLength(2);
    expect(urls.every((url) => !url.searchParams.has("type"))).toBe(true);
    expect(urls.map((url) => url.searchParams.get("offset"))).toEqual(["0", "200"]);
    expect(snapshot.chapters).toHaveLength(201);
    expect(snapshot.completeAfter).toBe("2026-09-28");
  });
});

describe("createBroadcastSnapshotLoader", () => {
  test("reuses the last successful chapter response while upstream is unavailable", async () => {
    installMemoryCache();
    let currentTime = new Date("2026-09-19T00:00:00.000Z");
    const successfulLoader = createBroadcastSnapshotLoader(
      createUpstreamClient(
        async () =>
          Response.json({
            total: 1,
            data: [{ id: 1, type: 0, sort: 1, airdate: "2026-09-20" }],
          }),
        () => currentTime,
      ),
    );
    await successfulLoader({
      subjectId: 42,
      plannedChapters: 1,
      now: currentTime,
      upstream: { gated: false, priority: "foreground" },
    });

    currentTime = new Date("2026-09-19T07:00:00.000Z");
    const unavailableLoader = createBroadcastSnapshotLoader(
      createUpstreamClient(
        async () => new Response(null, { status: 502 }),
        () => currentTime,
      ),
    );
    const snapshot = await unavailableLoader({
      subjectId: 42,
      plannedChapters: 1,
      now: currentTime,
      upstream: { gated: false, priority: "foreground" },
    });

    expect(snapshot.chapters).toEqual([{ sequence: 1, date: "2026-09-20" }]);
  });
});

describe("toSubjectBroadcast", () => {
  test("only exposes dates relevant across current user time zones", () => {
    const snapshot = createBroadcastSnapshot(
      42,
      [
        { type: "本篇", sequence: 1, date: "2026-09-17" },
        { type: "本篇", sequence: 2, date: "2026-09-18" },
        { type: "本篇", sequence: 3, date: "2026-09-20" },
      ],
      3,
      now,
    );

    expect(toSubjectBroadcast(snapshot, now)?.chapters).toEqual([
      { sequence: 2, date: "2026-09-18" },
      { sequence: 3, date: "2026-09-20" },
    ]);
  });
});

describe("isBroadcastSnapshotStale", () => {
  const hours = (value: number) => new Date(now.getTime() - value * 60 * 60 * 1000);

  test("refreshes airing subjects every six hours", () => {
    expect(isBroadcastSnapshotStale({ completeAfter: null, updatedAt: hours(5) }, now)).toBe(false);
    expect(isBroadcastSnapshotStale({ completeAfter: null, updatedAt: hours(6) }, now)).toBe(true);
    expect(
      isBroadcastSnapshotStale({ completeAfter: "2026-09-18", updatedAt: hours(6) }, now),
    ).toBe(true);
  });

  test("refreshes confirmed-complete subjects every thirty days", () => {
    const completed = { completeAfter: "2026-09-01" };
    expect(isBroadcastSnapshotStale({ ...completed, updatedAt: hours(29 * 24) }, now)).toBe(false);
    expect(isBroadcastSnapshotStale({ ...completed, updatedAt: hours(30 * 24) }, now)).toBe(true);
    expect(isBroadcastSnapshotStale(null, now)).toBe(true);
  });
});
