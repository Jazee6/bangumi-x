import { afterEach, vi, describe, expect, test } from "vitest";

import packageJson from "../../package.json";

import app from "./index";

const originalFetch = globalThis.fetch;
const expectedUserAgent = `Jazee6/${packageJson.name}/${packageJson.version}`;
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
    images: { large: `https://lain.bgm.tv/pic/cover/l/00/00/${id}.jpg` },
    ...overrides,
  };
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("GET /discover/search/characters", () => {
  test("searches and normalizes characters without detail requests", async () => {
    const upstreamFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      expect(url.pathname).toBe("/v0/search/characters");
      expect(url.searchParams.toString()).toBe("limit=24&offset=0");
      expect(init?.method).toBe("POST");
      expect(JSON.parse(String(init?.body))).toEqual({
        keyword: "高达",
        filter: { nsfw: false },
      });
      return Response.json({
        total: 2,
        data: [
          {
            id: 7,
            name: "RX-78-2",
            type: 2,
            summary: "地球联邦军的试作型机动战士。",
            images: { large: "https://lain.bgm.tv/pic/crt/l/00/00/7.jpg" },
          },
          { id: 8, name: "invalid", type: 9 },
        ],
      });
    });
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request(
      "/discover/search/characters?keyword=%E9%AB%98%E8%BE%BE&page=1&pageSize=24",
      {},
      bindings,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      page: 1,
      pageSize: 24,
      data: [
        {
          id: 7,
          name: "RX-78-2",
          type: "机体",
          summary: "地球联邦军的试作型机动战士。",
          imageUrl:
            "http://localhost/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcrt%2Fl%2F00%2F00%2F7.jpg&size=large",
        },
      ],
      hasPrevious: false,
      hasNext: false,
      total: 2,
    });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });
});

describe("GET /discover/search/persons", () => {
  test("searches and normalizes persons without detail requests", async () => {
    const upstreamFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      expect(url.pathname).toBe("/v0/search/persons");
      expect(JSON.parse(String(init?.body))).toEqual({
        keyword: "新海诚",
        filter: { nsfw: false },
      });
      return Response.json({
        total: 1,
        data: [
          {
            id: 11,
            name: "新海诚",
            type: 1,
            career: ["writer", "artist"],
            short_summary: "日本动画导演。",
            images: null,
          },
        ],
      });
    });
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request(
      "/discover/search/persons?keyword=%E6%96%B0%E6%B5%B7%E8%AF%9A&page=1&pageSize=24",
      {},
      bindings,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      page: 1,
      pageSize: 24,
      data: [
        {
          id: 11,
          name: "新海诚",
          type: "个人",
          careers: ["作家", "艺术家"],
          imageUrl: null,
          summary: "日本动画导演。",
        },
      ],
      hasPrevious: false,
      hasNext: false,
      total: 1,
    });
    expect(upstreamFetch).toHaveBeenCalledTimes(1);
  });
});

describe("GET split subject discovery", () => {
  test.each([
    ["book", "1"],
    ["anime", "2"],
    ["music", "3"],
    ["game", "4"],
    ["real", "6"],
  ] as const)("maps %s to Bangumi subject type %s", async (type, upstreamType) => {
    const upstreamFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      expect(url.pathname).toBe("/v0/subjects");
      expect(url.searchParams.get("type")).toBe(upstreamType);
      expect(url.searchParams.get("year")).toBe("2026");
      expect(url.searchParams.get("sort")).toBe("rank");
      expect(url.searchParams.get("limit")).toBe("50");
      expect(url.searchParams.get("offset")).toBe("0");
      expect(new Headers(init?.headers).get("User-Agent")).toBe(expectedUserAgent);
      return Response.json({ total: 0, limit: 50, offset: 0, data: [] });
    });
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request(
      `/discover/popular?type=${type}&year=2026&page=1&pageSize=24`,
      {},
      bindings,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      page: 1,
      pageSize: 24,
      data: [],
      hasPrevious: false,
      hasNext: false,
    });
  });

  test("searches subjects by trimmed keyword with the selected type and relevance order", async () => {
    const upstreamFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      expect(url.pathname).toBe("/v0/search/subjects");
      expect(url.searchParams.get("limit")).toBe("24");
      expect(url.searchParams.get("offset")).toBe("24");
      expect(init?.method).toBe("POST");
      expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
      expect(new Headers(init?.headers).get("User-Agent")).toBe(expectedUserAgent);
      expect(JSON.parse(String(init?.body))).toEqual({
        keyword: "高达",
        sort: "match",
        filter: { type: [2], nsfw: false },
      });
      return Response.json({
        total: 25,
        limit: 24,
        offset: 24,
        data: [upstreamSubject(9, 0)],
      });
    });
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request(
      "/discover/search/subjects?type=anime&keyword=%20%E9%AB%98%E8%BE%BE%20&page=2&pageSize=24",
      {},
      bindings,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      page: 2,
      pageSize: 24,
      data: [
        {
          id: 9,
          title: "条目 9",
          type: "动画",
          imageUrl:
            "http://localhost/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fl%2F00%2F00%2F9.jpg&size=large",
          score: 8.2,
          rank: null,
          nsfw: false,
        },
      ],
      hasPrevious: true,
      hasNext: false,
      total: 25,
    });
  });

  test.each(["a", "x".repeat(64)])("accepts a valid boundary keyword: %s", async (keyword) => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({ total: 0, data: [] }),
    ) as unknown as typeof fetch;

    const response = await app.request(
      `/discover/search/subjects?type=anime&keyword=${keyword}&page=1&pageSize=24`,
      {},
      bindings,
    );

    expect(response.status).toBe(200);
  });

  test("normalizes, filters, and rank-sorts untrusted subjects", async () => {
    globalThis.fetch = vi.fn(async () =>
      Response.json({
        total: 6,
        limit: 50,
        offset: 0,
        data: [
          upstreamSubject(1, 30),
          upstreamSubject(2, 10, { nsfw: true }),
          upstreamSubject(3, 0),
          upstreamSubject(4, 20, { name_cn: " ", images: null }),
          { id: 0, name: "invalid", rating: { rank: 1 } },
          upstreamSubject(5, 10, { rating: { rank: 10, score: 0 } }),
        ],
      }),
    ) as unknown as typeof fetch;

    const response = await app.request(
      "/discover/popular?type=anime&year=2026&page=1&pageSize=24",
      {},
      bindings,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      page: 1,
      pageSize: 24,
      data: [
        {
          id: 5,
          title: "条目 5",
          type: "动画",
          imageUrl:
            "http://localhost/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fl%2F00%2F00%2F5.jpg&size=large",
          score: null,
          rank: 10,
          nsfw: false,
        },
        {
          id: 4,
          title: "Subject 4",
          type: "动画",
          imageUrl: null,
          score: 8.2,
          rank: 20,
          nsfw: false,
        },
        {
          id: 1,
          title: "条目 1",
          type: "动画",
          imageUrl:
            "http://localhost/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fl%2F00%2F00%2F1.jpg&size=large",
          score: 8.2,
          rank: 30,
          nsfw: false,
        },
      ],
      hasPrevious: false,
      hasNext: false,
    });
  });

  test("paginates the filtered collection without duplicates", async () => {
    const subjects = Array.from({ length: 25 }, (_, index) =>
      upstreamSubject(index + 1, index + 1),
    );
    globalThis.fetch = vi.fn(async () =>
      Response.json({ total: subjects.length, limit: 50, offset: 0, data: subjects }),
    ) as unknown as typeof fetch;

    const first = await app.request(
      "/discover/popular?type=anime&year=2026&page=1&pageSize=24",
      {},
      bindings,
    );
    const second = await app.request(
      "/discover/popular?type=anime&year=2026&page=2&pageSize=24",
      {},
      bindings,
    );
    const firstBody = (await first.json()) as { data: Array<{ id: number }>; hasNext: boolean };
    const secondBody = (await second.json()) as {
      data: Array<{ id: number }>;
      hasPrevious: boolean;
      hasNext: boolean;
    };

    expect(firstBody.data).toHaveLength(24);
    expect(firstBody.hasNext).toBe(true);
    expect(secondBody.data.map((subject) => subject.id)).toEqual([25]);
    expect(secondBody.hasPrevious).toBe(true);
    expect(secondBody.hasNext).toBe(false);
    expect(firstBody.data.some((subject) => subject.id === 25)).toBe(false);
  });

  test("uses the current year when year is omitted", async () => {
    const upstreamFetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      expect(url.searchParams.get("year")).toBe(new Date().getFullYear().toString());
      return Response.json({ total: 0, limit: 50, offset: 0, data: [] });
    });
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request("/discover/popular?type=anime", {}, bindings);

    expect(response.status).toBe(200);
  });

  test.each([
    "type=unknown",
    "type=anime&year=0",
    `type=anime&year=${new Date().getFullYear() + 1}`,
    "type=anime&page=0",
    "type=anime&pageSize=12",
    "type=anime&keyword=%20%20",
    `type=anime&keyword=${"x".repeat(65)}`,
  ])("rejects invalid query parameters: %s", async (query) => {
    const upstreamFetch = vi.fn(async () => new Response("unexpected"));
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request(`/discover/popular?${query}`, {}, bindings);

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: "INVALID_DISCOVERY_QUERY",
      message: "发现参数无效。",
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("maps malformed or unsuccessful upstream responses to the public error", async () => {
    globalThis.fetch = vi.fn(async () => new Response("not json")) as unknown as typeof fetch;

    const response = await app.request("/discover/popular?type=anime", {}, bindings);

    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({
      code: "DISCOVERY_UPSTREAM_ERROR",
      message: "发现内容暂时无法加载，请稍后重试。",
    });
  });
});
