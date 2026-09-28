import { afterEach, describe, expect, test, vi } from "vitest";

import { createApp } from "./index";

import { renderOgImage, type OgCache, type OgCard } from "./og";
import fallbackFont from "./assets/noto-sans-sc-brand.ttf";

const bindings = {
  BGM_API_URL: "https://api.example.test",
  WEB_ORIGIN: "https://web.example.test",
};

const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const fontBytes = fallbackFont;
const coverBytes = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  ),
  (character) => character.charCodeAt(0),
);

class MemoryOgCache implements OgCache {
  readonly entries = new Map<string, Response>();
  matches = 0;
  puts = 0;

  async match(request: Request): Promise<Response | undefined> {
    this.matches += 1;
    return this.entries.get(request.url)?.clone();
  }

  async put(request: Request, response: Response): Promise<void> {
    this.puts += 1;
    this.entries.set(request.url, response.clone());
  }
}

function googleFontFetch() {
  return vi.fn(async (input: string | URL | Request) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.hostname === "fonts.googleapis.com") {
      expect(url.searchParams.get("text")).toContain("Bangumi X");
      return new Response(
        "@font-face { font-weight: 700; src: url(https://fonts.gstatic.com/brand.ttf) format('truetype'); }",
      );
    }
    if (url.hostname === "fonts.gstatic.com") {
      return new Response(fontBytes, { headers: { "Content-Type": "font/ttf" } });
    }
    throw new Error(`Unexpected request: ${url}`);
  });
}

async function expectBrandPng(response: Response) {
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toBe("image/png");
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect(bytes.slice(0, 8)).toEqual(Uint8Array.from(PNG_SIGNATURE));
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  expect(view.getUint32(16)).toBe(1200);
  expect(view.getUint32(20)).toBe(630);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("dynamic Open Graph image HTTP contract", () => {
  test("renders Mini brand images at both share aspect ratios", async () => {
    const fetch = googleFontFetch();
    for (const [format, width, height] of [
      ["friend", 1000, 800],
      ["timeline", 800, 800],
    ] as const) {
      const result = await renderOgImage(
        { cacheKey: "brand", title: "Bangumi X", type: "", badges: [], brand: true },
        { fetch, cacheOrigin: "https://example.test", miniFormat: format },
      );
      const view = new DataView(
        result.bytes.buffer,
        result.bytes.byteOffset,
        result.bytes.byteLength,
      );
      expect(view.getUint32(16)).toBe(width);
      expect(view.getUint32(20)).toBe(height);
    }
  });

  test("isolates Mini share caches and validates keyword image input", async () => {
    const renderOgImage = vi.fn(async () => ({ bytes: coverBytes, cacheable: true }));
    const app = createApp({
      fetch: googleFontFetch(),
      renderOgImage,
      ogCache: new MemoryOgCache(),
    });
    const web = await app.request("/og/brand", {}, bindings);
    const mini = await app.request("/og/brand?mini=timeline", {}, bindings);
    expect(web.headers.get("ETag")).not.toBe(mini.headers.get("ETag"));
    expect(renderOgImage).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ miniFormat: "timeline" }),
    );
    const keyword = await app.request(
      "/og/mini-search/subjects?keyword=%E5%B0%91%E5%A5%B3&mini=friend",
      {},
      bindings,
    );
    expect(keyword.status).toBe(200);
    expect(renderOgImage).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "搜索「少女」" }),
      expect.objectContaining({ miniFormat: "friend" }),
    );
    expect((await app.request("/og/mini-search/subjects?keyword=x", {}, bindings)).status).toBe(
      400,
    );
  });
  test("renders a cached 1200x630 Chinese brand PNG with a versioned ETag", async () => {
    const fetch = googleFontFetch();
    const cache = new MemoryOgCache();
    const app = createApp({ fetch, ogCache: cache });

    const first = await app.request("/og/brand", {}, bindings);
    const etag = first.headers.get("ETag");

    expect(etag).toContain("og-v3-brand");
    expect(first.headers.get("Cache-Control")).toContain("public, max-age=604800");
    await expectBrandPng(first);

    const second = await app.request("/og/brand", {}, bindings);
    await expectBrandPng(second);
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(cache.puts).toBeGreaterThanOrEqual(3);
    expect(
      [...cache.entries.keys()].every((url) => new URL(url).origin === "http://localhost"),
    ).toBe(true);
  });

  test("serves cached aggregate images without loading their upstream data", async () => {
    const cache = new MemoryOgCache();
    cache.entries.set(
      "http://localhost/__og-cache/og-v3/schedule-monday",
      new Response(coverBytes, { headers: { "Content-Type": "image/png" } }),
    );
    const fetch = vi.fn(async () => {
      throw new Error("aggregate data should not load on a cache hit");
    });
    const app = createApp({ fetch, ogCache: cache });

    const response = await app.request("/og/schedule/monday", {}, bindings);

    expect(response.status).toBe(200);
    expect(await response.arrayBuffer()).toEqual(coverBytes.buffer);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("returns 304 when the crawler already has the current template", async () => {
    const app = createApp({ fetch: googleFontFetch() });
    const response = await app.request(
      "/og/brand",
      { headers: { "If-None-Match": 'W/"og-v3-brand"' } },
      bindings,
    );

    expect(response.status).toBe(304);
    expect(await response.text()).toBe("");
  });

  test("rejects free-form brand card parameters without caching the error", async () => {
    const app = createApp({ fetch: googleFontFetch() });
    const response = await app.request("/og/brand?title=%3Cscript%3E", {}, bindings);

    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(await response.json()).toEqual({
      code: "INVALID_OG_QUERY",
      message: "分享卡片参数无效。",
    });
  });

  test("uses the bundled brand font when Google Fonts fails", async () => {
    const app = createApp({
      fetch: vi.fn(async () => new Response(null, { status: 503 })),
    });

    await expectBrandPng(await app.request("/og/brand", {}, bindings));
  });

  test("does not cache a generic subject fallback after a font outage", async () => {
    const cache = new MemoryOgCache();
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.hostname === "api.example.test") {
        return Response.json({ id: 42, name_cn: "暂时无法加载字体的条目", type: 2 });
      }
      return new Response(null, { status: 503 });
    });
    const app = createApp({ fetch, ogCache: cache });

    const response = await app.request("/og/subjects/42", {}, bindings);

    await expectBrandPng(response.clone());
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect(response.headers.get("X-OG-Fallback")).toBe("brand");
    expect(cache.puts).toBe(0);
  });

  test.each([
    ["/og/schedule/monday", "schedule-monday", "每日放送", "", ["星期一"]],
    ["/og/discover/anime", "discover-2026-anime", "动画本年度热门", "发现", ["2026 年", "动画"]],
    [
      "/og/rankings/2026/winter",
      "rankings-2026-winter",
      "2026 年冬季排行榜",
      "排行榜",
      ["2026 年", "冬季", "动画"],
    ],
  ] as const)(
    "renders a whitelist aggregate card for %s",
    async (path, cacheKey, title, type, badges) => {
      const renderOgImage = vi.fn(async (card: OgCard) => {
        expect(card.cacheKey).toBe(cacheKey);
        expect(card.title).toBe(title);
        expect(card.type).toBe(type);
        expect(card.badges).toEqual([...badges]);
        expect(card.mediaLayout).toBe("stack");
        return { bytes: coverBytes, cacheable: true };
      });
      const app = createApp({
        fetch: vi.fn(async () => new Response(null, { status: 503 })),
        now: () => new Date("2026-02-01T00:00:00.000Z"),
        renderOgImage,
      });

      const response = await app.request(path, {}, bindings);

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("image/png");
      expect(response.headers.get("ETag")).toContain(cacheKey);
    },
  );

  test.each([
    "/og/schedule/funday",
    "/og/discover/other",
    "/og/schedule/monday?title=x",
    "/og/rankings/1979/winter",
    "/og/rankings/2026/rainy",
    "/og/rankings/2026/winter?title=x",
  ])("rejects non-whitelist aggregate card input: %s", async (path) => {
    const response = await createApp().request(path, {}, bindings);
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });

  test("uses the subject detail field hierarchy for subject cards", async () => {
    const renderOgImage = vi.fn(async (card: OgCard) => {
      expect(card.score).toBeNull();
      expect(card.badges).toEqual(["2026-04-01"]);
      return { bytes: coverBytes, cacheable: false };
    });
    const app = createApp({
      fetch: vi.fn(async () =>
        Response.json({ id: 42, name_cn: "书籍条目", type: 1, date: "2026-04-01" }),
      ),
      renderOgImage,
    });

    expect((await app.request("/og/subjects/42", {}, bindings)).status).toBe(200);
    expect(renderOgImage).toHaveBeenCalledTimes(1);
  });

  test.each(["chapters", "characters", "persons"] as const)(
    "uses the unchanged subject card for the %s subject view",
    async (view) => {
      const renderOgImage = vi.fn(async (card: OgCard) => {
        expect(card).toMatchObject({
          cacheKey: `subject-42-${view}`,
          title: "测试条目",
          type: "动画",
          score: 8.8,
          badges: ["TV", "#12", "2026-04-01", "全 24 话"],
        });
        return { bytes: coverBytes, cacheable: true };
      });
      const app = createApp({
        fetch: vi.fn(async () =>
          Response.json({
            id: 42,
            name_cn: "测试条目",
            type: 2,
            platform: "TV",
            date: "2026-04-01",
            total_chapters: 24,
            rating: { score: 8.8, rank: 12 },
          }),
        ),
        renderOgImage,
      });

      expect((await app.request(`/og/subjects/42/${view}`, {}, bindings)).status).toBe(200);
    },
  );

  test("marks an NSFW subject card as sensitive while preserving its identity", async () => {
    const renderOgImage = vi.fn(async (card: OgCard) => {
      expect(card.title).toBe("敏感条目");
      expect(card.sensitive).toBe(true);
      expect(card.imageUrls?.[0]).toContain("/images?url=");
      return { bytes: coverBytes, cacheable: true };
    });
    const app = createApp({
      fetch: vi.fn(async () =>
        Response.json({
          id: 69,
          name_cn: "敏感条目",
          type: 2,
          nsfw: true,
          images: { large: "https://lain.bgm.tv/pic/cover/l/69.jpg" },
        }),
      ),
      renderOgImage,
    });

    expect((await app.request("/og/subjects/69", {}, bindings)).status).toBe(200);
  });

  test("renders an NSFW card without requesting its cover", async () => {
    const fetch = googleFontFetch();
    const result = await renderOgImage(
      {
        cacheKey: "subject-69",
        title: "敏感条目",
        type: "动画",
        badges: ["2026-01-01"],
        imageUrls: [
          "http://localhost/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fl%2F69.jpg&size=large",
        ],
        sensitive: true,
      },
      { fetch, cacheOrigin: "http://localhost" },
    );

    const bytes = result.bytes;
    expect(bytes.slice(0, 8)).toEqual(Uint8Array.from(PNG_SIGNATURE));
    expect(fetch).toHaveBeenCalledTimes(4);
    expect(
      fetch.mock.calls.some(
        ([input]) =>
          new URL(input instanceof Request ? input.url : input).hostname === "lain.bgm.tv",
      ),
    ).toBe(false);
  });

  test("retries and renders a subject card with a transiently unavailable cover", async () => {
    let coverAttempts = 0;
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.hostname === "api.example.test") {
        return Response.json({
          id: 42,
          name_cn: "封面测试条目",
          type: 2,
          images: { large: "https://lain.bgm.tv/pic/cover/l/42.jpg" },
        });
      }
      if (url.hostname === "fonts.googleapis.com") {
        return new Response(
          "@font-face { src: url(https://fonts.gstatic.com/subject.ttf) format('truetype'); }",
        );
      }
      if (url.hostname === "fonts.gstatic.com") return new Response(fontBytes);
      if (url.hostname === "lain.bgm.tv") {
        coverAttempts += 1;
        return coverAttempts === 1
          ? new Response(null, { status: 503 })
          : new Response(coverBytes, { headers: { "Content-Type": "image/png" } });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const app = createApp({ fetch });

    await expectBrandPng(await app.request("/og/subjects/42", {}, bindings));
    expect(coverAttempts).toBe(2);
  });

  test("drops a failed subject cover and still renders a branded PNG", async () => {
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.hostname === "api.example.test") {
        return Response.json({
          id: 42,
          name: "Original",
          name_cn: "测试条目",
          type: 2,
          date: "2026-04-01",
          rating: { score: 8.2, rank: 12 },
          images: { large: "https://lain.bgm.tv/pic/cover/l/42.jpg" },
        });
      }
      if (url.hostname === "fonts.googleapis.com") {
        return new Response(
          "@font-face { src: url(https://fonts.gstatic.com/subject.ttf) format('truetype'); }",
        );
      }
      if (url.hostname === "fonts.gstatic.com") {
        return new Response(fontBytes);
      }
      if (url.hostname === "lain.bgm.tv") {
        return new Response(null, { status: 404 });
      }
      throw new Error(`Unexpected request: ${url}`);
    });
    const app = createApp({ fetch });

    await expectBrandPng(await app.request("/og/subjects/42", {}, bindings));
    expect(
      fetch.mock.calls.some(
        ([input]) =>
          new URL(input instanceof Request ? input.url : input).hostname === "lain.bgm.tv",
      ),
    ).toBe(true);
  });

  test("preserves a subject 404 instead of rendering a soft error card", async () => {
    const app = createApp({
      fetch: vi.fn(async () => new Response(null, { status: 404 })),
    });

    const response = await app.request("/og/subjects/404", {}, bindings);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "SUBJECT_NOT_FOUND",
      message: "条目不存在。",
      retryable: false,
    });
  });

  test("renders a chapter OG card with parent subject context and cover", async () => {
    const renderOgImage = vi.fn(async (card: OgCard) => {
      expect(card.cacheKey).toBe("chapter-10");
      expect(card.title).toBe("最终话");
      expect(card.type).toBe("章节");
      expect(card.context).toBe("测试条目");
      expect(card.badges).toEqual(["2026-03-31"]);
      expect(card.imageUrls?.[0]).toContain("/images?url=");
      return { bytes: coverBytes, cacheable: true };
    });
    const fetch = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : input);
      if (url.pathname.includes("/v0/episodes/10")) {
        return Response.json({
          id: 10,
          subject_id: 42,
          type: 0,
          name_cn: "最终话",
          airdate: "2026-03-31",
        });
      }
      return Response.json({
        id: 42,
        name_cn: "测试条目",
        type: 2,
        images: { large: "https://lain.bgm.tv/pic/cover/l/42.jpg" },
      });
    });
    const app = createApp({ fetch, renderOgImage });

    const response = await app.request("/og/chapters/10", {}, bindings);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(response.headers.get("ETag")).toContain("chapter-10");
  });

  test("preserves a chapter 404 instead of rendering a soft error card", async () => {
    const app = createApp({
      fetch: vi.fn(async () => new Response(null, { status: 404 })),
    });

    const response = await app.request("/og/chapters/404", {}, bindings);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      code: "CHAPTER_NOT_FOUND",
      message: "章节不存在。",
      retryable: false,
    });
  });

  test.each([
    ["characters", "201", "斯派克", "角色", ["男", "2044年6月26日"]],
    ["persons", "301", "山寺宏一", "个人", ["声优、演员", "男"]],
  ] as const)("renders a trusted %s entity OG card", async (kind, id, name, type, facts) => {
    const renderOgImage = vi.fn(async (card: OgCard) => {
      expect(card.cacheKey).toBe(`${kind === "characters" ? "character" : "person"}-${id}`);
      expect(card.title).toBe(name);
      expect(card.type).toBe(type);
      expect(card.badges).toEqual([...facts]);
      expect(card.imageUrls?.[0]).toContain("/images?url=");
      return { bytes: coverBytes, cacheable: true };
    });
    const app = createApp({
      fetch: vi.fn(async () =>
        Response.json(
          kind === "characters"
            ? {
                id: Number(id),
                name,
                type: 1,
                gender: "男",
                birth_year: 2044,
                birth_mon: 6,
                birth_day: 26,
                images: { large: "https://lain.bgm.tv/pic/crt/l/test.jpg" },
              }
            : {
                id: Number(id),
                name,
                type: 1,
                career: ["声优", "演员"],
                gender: "男",
                images: { large: "https://lain.bgm.tv/pic/crt/l/person.jpg" },
              },
        ),
      ),
      renderOgImage,
    });

    const response = await app.request(`/og/${kind}/${id}`, {}, bindings);
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("image/png");
    expect(renderOgImage).toHaveBeenCalledTimes(1);
  });

  test("rejects entity OG free-form parameters and preserves missing entities", async () => {
    const invalid = await createApp().request("/og/characters/201?title=bad", {}, bindings);
    expect(invalid.status).toBe(400);
    const invalidSubjectView = await createApp().request("/og/subjects/42/reviews", {}, bindings);
    expect(invalidSubjectView.status).toBe(400);

    const app = createApp({ fetch: vi.fn(async () => new Response(null, { status: 404 })) });
    const missing = await app.request("/og/persons/999", {}, bindings);
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({
      code: "PERSON_NOT_FOUND",
      message: "人物不存在。",
      retryable: false,
    });
  });

  test("temporarily redirects to the static brand image after a total renderer failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const app = createApp({
      renderOgImage: async () => {
        throw new Error("WASM unavailable");
      },
    });

    const response = await app.request("/og/brand", {}, bindings);

    expect(response.status).toBe(307);
    expect(response.headers.get("Location")).toBe("https://web.example.test/og-brand.png");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});
