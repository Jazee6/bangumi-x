import { afterEach, vi, describe, expect, test } from "vitest";

import packageJson from "../../package.json";

import app from "./index";

const originalFetch = globalThis.fetch;
const expectedUserAgent = `Jazee6/${packageJson.name}/${packageJson.version}`;
const bindings = {
  BGM_API_URL: "https://api.example.test",
  WEB_ORIGIN: "https://web.example.test",
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Server error boundary", () => {
  test("returns the public JSON error for an invalid image URL", async () => {
    const response = await app.request(
      "/images?url=https://example.com/image.jpg&size=large",
      {},
      bindings,
    );

    expect(response.status).toBe(400);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({
      code: "INVALID_IMAGE_URL",
      message: "图片地址无效。",
      retryable: false,
    });
  });

  test("returns the public JSON error for an unmatched route", async () => {
    const response = await app.request("/missing", {}, bindings);

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("application/json");
    expect(await response.json()).toEqual({
      code: "NOT_FOUND",
      message: "请求的资源不存在。",
      retryable: false,
    });
  });

  test("maps a Bangumi failure to a public upstream error", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 503 }),
    ) as unknown as typeof fetch;

    const response = await app.request("/schedule", {}, bindings);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      code: "BANGUMI_UPSTREAM_ERROR",
      message: "每日放送暂时无法加载，请稍后重试。",
      retryable: true,
    });
  });

  test("maps invalid upstream JSON to the same public upstream error", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response("not-json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    const response = await app.request("/schedule", {}, bindings);

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      code: "BANGUMI_UPSTREAM_ERROR",
      message: "每日放送暂时无法加载，请稍后重试。",
      retryable: true,
    });
  });

  test("hides details from unexpected errors", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const throwingBindings = new Proxy(bindings, {
      get() {
        throw new Error("secret internal detail");
      },
    });

    const response = await app.request("/schedule", {}, throwingBindings);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "服务暂时不可用，请稍后重试。",
      retryable: true,
    });
    expect(JSON.stringify(body).includes("secret internal detail")).toBe(false);
    expect(errorLog).toHaveBeenCalled();
  });

  test("rejects an invalid subject ID before requesting Bangumi", async () => {
    const upstreamFetch = vi.fn(async () => new Response("unexpected"));
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request("/subjects/not-an-id", {}, bindings);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_SUBJECT_ID",
      message: "条目 ID 无效。",
      retryable: false,
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("rejects invalid chapter pagination before requesting Bangumi", async () => {
    const upstreamFetch = vi.fn(async () => new Response("unexpected"));
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request("/subjects/42/chapters?limit=201&offset=-1", {}, bindings);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_PAGINATION",
      message: "分页参数无效。",
      retryable: false,
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("rejects an invalid chapter ID before requesting Bangumi", async () => {
    const upstreamFetch = vi.fn(async () => new Response("unexpected"));
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request("/chapters/0", {}, bindings);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_CHAPTER_ID",
      message: "章节 ID 无效。",
      retryable: false,
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("includes the subject cover in a chapter detail", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/v0/episodes/10")) {
        return Response.json({
          id: 10,
          subject_id: 42,
          type: 0,
          sort: 1,
          name_cn: "第一章",
        });
      }
      if (url.endsWith("/v0/subjects/42")) {
        return Response.json({
          id: 42,
          type: 2,
          name_cn: "测试条目",
          nsfw: false,
          images: { large: "https://lain.bgm.tv/pic/cover/l/42.jpg" },
        });
      }
      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;

    const response = await app.request("/chapters/10", {}, bindings);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      id: 10,
      subject: {
        id: 42,
        title: "测试条目",
        type: "动画",
        nsfw: false,
        imageUrl:
          "http://localhost/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fl%2F42.jpg&size=large",
      },
    });
  });

  test("reports a missing parent subject of a chapter as not found", async () => {
    globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
      if (String(input).endsWith("/v0/episodes/11")) {
        return Response.json({ id: 11, subject_id: 43, type: 0, sort: 1, name_cn: "第一章" });
      }
      return new Response(null, { status: 404 });
    }) as unknown as typeof fetch;

    const response = await app.request("/chapters/11", {}, bindings);

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: "SUBJECT_NOT_FOUND" });
  });

  test("rejects invalid person and character IDs before requesting Bangumi", async () => {
    const upstreamFetch = vi.fn(async () => new Response("unexpected"));
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const personResponse = await app.request("/persons/nope", {}, bindings);
    const characterResponse = await app.request("/characters/-2", {}, bindings);

    expect(personResponse.status).toBe(400);
    expect(await personResponse.json()).toEqual({
      code: "INVALID_PERSON_ID",
      message: "人物 ID 无效。",
      retryable: false,
    });
    expect(characterResponse.status).toBe(400);
    expect(await characterResponse.json()).toEqual({
      code: "INVALID_CHARACTER_ID",
      message: "角色 ID 无效。",
      retryable: false,
    });
    expect(upstreamFetch).not.toHaveBeenCalled();
  });

  test("serves normalized subject persons with the package version user agent", async () => {
    const upstreamFetch = vi.fn(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("User-Agent")).toBe(expectedUserAgent);
      return Response.json([
        { id: 7, name: "制作社", type: 2, career: ["producer"], relation: "制作", eps: "" },
      ]);
    });
    globalThis.fetch = upstreamFetch as unknown as typeof fetch;

    const response = await app.request("/subjects/42/persons", {}, bindings);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      total: 1,
      fetchedAt: expect.any(String),
      groups: [
        {
          relation: "制作",
          items: [
            {
              id: 7,
              name: "制作社",
              type: "公司",
              careers: ["制作人"],
              chapters: null,
              imageUrl: null,
            },
          ],
        },
      ],
    });
  });

  test("maps an upstream subject 404 to the public not-found error", async () => {
    globalThis.fetch = vi.fn(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;

    const response = await app.request("/subjects/42", {}, bindings);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "SUBJECT_NOT_FOUND",
      message: "条目不存在。",
      retryable: false,
    });
  });
});
