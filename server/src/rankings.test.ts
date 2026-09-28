import { afterEach, vi, describe, expect, test } from "vitest";

import app from "./index";

const originalFetch = globalThis.fetch;
const bindings = {
  BGM_API_URL: "https://api.example.test",
  WEB_ORIGIN: "https://web.example.test",
};

function upstreamSubject(id: number, rank: number, overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: `Subject ${id}`,
    name_cn: `条目 ${id}`,
    type: 2,
    nsfw: false,
    rating: { rank, score: 8.2 },
    images: null,
    ...overrides,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("GET /rankings", () => {
  test("merges the three winter months into a stable ranked anime collection", async () => {
    const upstreamFetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      expect(url.pathname).toBe("/v0/subjects");
      expect(url.searchParams.get("type")).toBe("2");
      expect(url.searchParams.get("year")).toBe("2026");
      expect(url.searchParams.get("sort")).toBe("rank");
      expect(url.searchParams.get("limit")).toBe("50");
      expect(url.searchParams.get("offset")).toBe("0");

      const month = Number(url.searchParams.get("month"));
      if (month === 1) {
        return Response.json({ data: [upstreamSubject(1, 30), upstreamSubject(2, 10)] });
      }
      if (month === 2) {
        return Response.json({
          data: [
            upstreamSubject(1, 30),
            upstreamSubject(3, 20, { nsfw: true }),
            upstreamSubject(4, 0),
          ],
        });
      }
      return Response.json({ data: [upstreamSubject(5, 10), upstreamSubject(6, 20)] });
    });
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request(
      "/rankings?year=2026&season=winter&page=1&pageSize=24",
      {},
      bindings,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { data: Array<{ id: number; rank: number }> };
    expect(body).toMatchObject({
      page: 1,
      pageSize: 24,
      hasPrevious: false,
      hasNext: false,
      total: 4,
    });
    expect(body.data.map(({ id, rank }) => [id, rank])).toEqual([
      [2, 10],
      [5, 10],
      [6, 20],
      [1, 30],
    ]);
    expect(upstreamFetch).toHaveBeenCalledTimes(3);
  });

  test.each([
    ["winter", [1, 2, 3]],
    ["spring", [4, 5, 6]],
    ["summer", [7, 8, 9]],
    ["autumn", [10, 11, 12]],
  ] as const)("maps %s to its three natural months", async (season, expectedMonths) => {
    const months: number[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      months.push(Number(url.searchParams.get("month")));
      return Response.json({ data: [] });
    }) as unknown as typeof fetch;

    const response = await app.request(
      `/rankings?year=2024&season=${season}&page=1&pageSize=24`,
      {},
      bindings,
    );

    expect(response.status).toBe(200);
    expect(months.sort((left, right) => left - right)).toEqual([...expectedMonths]);
    expect(await response.json()).toMatchObject({ data: [], total: 0, hasNext: false });
  });

  test("caps the merged collection at 50 items and exposes the third logical page", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      const month = Number(url.searchParams.get("month"));
      const start = month === 1 ? 1 : month === 2 ? 51 : 101;
      return Response.json({
        data: Array.from({ length: 50 }, (_, index) =>
          upstreamSubject(start + index, start + index),
        ),
      });
    }) as unknown as typeof fetch;

    const response = await app.request(
      "/rankings?year=2026&season=winter&page=3&pageSize=24",
      {},
      bindings,
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      data: Array<{ id: number }>;
      total: number;
      hasPrevious: boolean;
      hasNext: boolean;
    };
    expect(body.data.map((subject) => subject.id)).toEqual([49, 50]);
    expect(body).toMatchObject({ total: 50, hasPrevious: true, hasNext: false });
  });

  test.each([
    "year=1979&season=winter&page=1&pageSize=24",
    `year=${new Date().getFullYear() + 1}&season=winter&page=1&pageSize=24`,
    "year=2026&season=rainy&page=1&pageSize=24",
    "year=2026&season=winter&page=0&pageSize=24",
    "year=2026&season=winter&page=1&pageSize=12",
  ])("rejects invalid ranking parameters: %s", async (query) => {
    const upstreamFetch = vi.fn(async () => new Response("unexpected"));
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request(`/rankings?${query}`, {}, bindings);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_RANKINGS_QUERY",
      message: "排行榜参数无效。",
      retryable: false,
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("rejects future seasons for the current year", async () => {
    const now = new Date("2026-02-15T00:00:00.000Z"); // winter
    const { createApp } = await import("./index");
    const testApp = createApp({
      fetch: vi.fn(async () => Response.json({ data: [] })),
      now: () => now,
    });

    const response = await testApp.request(
      "/rankings?year=2026&season=spring&page=1&pageSize=24",
      {},
      bindings,
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_RANKINGS_QUERY",
      message: "排行榜参数无效。",
      retryable: false,
    });
  });

  test("maps any failed monthly request to the ranking upstream error", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return url.searchParams.get("month") === "2"
        ? new Response("failure", { status: 503 })
        : Response.json({ data: [] });
    }) as unknown as typeof fetch;

    const response = await app.request(
      "/rankings?year=2026&season=winter&page=1&pageSize=24",
      {},
      bindings,
    );

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      code: "RANKINGS_UPSTREAM_ERROR",
      message: "排行榜暂时无法加载，请稍后重试。",
      retryable: true,
    });
  });
});
