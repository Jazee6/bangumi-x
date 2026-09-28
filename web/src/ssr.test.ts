import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { validateXmlWellFormedness } from "./lib/xml";

interface ProductionServer {
  fetch(request: Request): Promise<Response>;
}

const webRoot = resolve(import.meta.dir, "..");
const serverEntry = resolve(webRoot, "dist/server/server.js");
const originalFetch = globalThis.fetch;
let server: ProductionServer;

beforeAll(async () => {
  const build = Bun.spawnSync(["bun", "run", "build"], {
    cwd: webRoot,
    // bun test 会设置 NODE_ENV=test，构建会因此带上 React 开发版；这里测试生产构建。
    env: {
      ...process.env,
      NODE_ENV: "production",
      VITE_SERVER_URL: "https://server.example.test",
    },
    stdout: "pipe",
    stderr: "pipe",
  });

  if (!build.success) {
    throw new Error(
      `Web production build failed:\n${build.stdout.toString()}\n${build.stderr.toString()}`,
    );
  }

  const module = (await import(`${pathToFileURL(serverEntry).href}?test=${Date.now()}`)) as {
    default: ProductionServer;
  };
  server = module.default;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  mock.restore();
});

describe("Web production SSR HTTP handler", () => {
  test("packages the SSR function and static fallback image for EdgeOne", async () => {
    const edgeoneRoot = resolve(webRoot, ".edgeone");

    expect(
      await Bun.file(resolve(edgeoneRoot, "cloud-functions/ssr-node/handler.js")).exists(),
    ).toBe(true);
    expect(await Bun.file(resolve(edgeoneRoot, "assets/og-brand.png")).exists()).toBe(true);
  });

  test("rejects cross-site server function requests", async () => {
    const response = await server.fetch(
      new Request("https://bgmx.jaze.top/_serverFn/csrf-probe", {
        method: "POST",
        headers: {
          Origin: "https://evil.example",
          "Sec-Fetch-Site": "cross-site",
        },
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.text()).toBe("Forbidden");
  });

  test("renders the home route through its loader, head, and document shell", async () => {
    const serverFetch = mock(async (input: string | URL | Request) => {
      const request = input instanceof Request ? input : new Request(input);
      expect(request.url).toBe("https://server.example.test/schedule");
      return Response.json({
        fetchedAt: "2026-09-13T03:00:00.000Z",
        days: [
          {
            weekday: 1,
            items: [
              {
                id: 1,
                title: "周一</script><script>alert(1)</script>",
                imageUrl: null,
                score: 8,
              },
            ],
          },
          { weekday: 2, items: [] },
          { weekday: 3, items: [] },
          { weekday: 4, items: [] },
          { weekday: 5, items: [] },
          { weekday: 6, items: [] },
          { weekday: 7, items: [] },
        ],
      });
    });
    globalThis.fetch = serverFetch as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/"));

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    const html = await response.text();
    expect(html).toContain('<html lang="zh-CN"');
    expect(html).toContain("<title>每日放送 - Bangumi X</title>");
    expect(html).toMatch(/<link[^>]+rel="stylesheet"[^>]+href="\/assets\//);
    expect(html).toContain("每日放送");
    expect(html).toContain("星期一");
    expect(html).toContain('href="/schedule/monday"');
    expect(html).toContain('href="/schedule/sunday"');
    expect(html).toContain('rel="canonical" href="https://bgmx.jaze.top/"');
    expect(html).toContain("application/ld+json");
    expect(html).toContain("Jazee6");
    expect(html).toContain(
      "\\u003c/script\\u003e\\u003cscript\\u003ealert(1)\\u003c/script\\u003e",
    );
    expect(html).not.toContain("</script><script>alert(1)");
    expect(serverFetch).toHaveBeenCalledTimes(1);
  });

  test("returns a 404 noindex document for an unmatched route", async () => {
    globalThis.fetch = mock(async () => {
      throw new Error("The not-found route must not call Server");
    }) as unknown as typeof fetch;

    const response = await server.fetch(
      new Request("https://bgmx.jaze.top/edgeone-ssr-not-found-probe"),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get("Content-Type")).toContain("text/html");
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    const html = await response.text();
    expect(html).toContain('<html lang="zh-CN"');
    expect(html).toContain("页面不存在");
    expect(html).toContain('name="robots" content="noindex, nofollow"');
    expect(html).not.toContain('rel="canonical"');
    expect(html).not.toContain('"@type":"WebSite"');
  });

  test.each([
    ["/about", "关于"],
    ["/privacy", "隐私说明"],
    ["/terms", "服务条款"],
  ] as const)("renders the trust page %s", async (path, heading) => {
    const response = await server.fetch(new Request(`https://bgmx.jaze.top${path}`));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(`<h1 class="text-3xl font-semibold tracking-tight">${heading}</h1>`);
    expect(html).toContain(`rel="canonical" href="https://bgmx.jaze.top${path}"`);
    expect(html).toContain("返回应用");
    expect(html).not.toContain('aria-label="面包屑"');
    expect(html).toContain('href="/about"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/terms"');
    expect(html).not.toContain('data-slot="sidebar-wrapper"');
  });

  test.each(["/collections", "/progress"])(
    "marks private page %s noindex and no-store",
    async (path) => {
      const response = await server.fetch(new Request(`https://bgmx.jaze.top${path}`));
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
      expect(response.headers.get("Cache-Control")).toContain("no-store");
      expect(await response.text()).toContain('name="robots" content="noindex, nofollow"');
    },
  );

  test("redirects the duplicate discover entry to anime", async () => {
    const response = await server.fetch(new Request("https://bgmx.jaze.top/discover"));
    expect(response.status).toBe(301);
    expect(response.headers.get("Location")).toContain("/discover/anime");
  });

  test("renders a stable weekday page and rejects an invalid weekday", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        fetchedAt: "2026-09-13T03:00:00.000Z",
        days: Array.from({ length: 7 }, (_, index) => ({
          weekday: index + 1,
          items: index === 0 ? [{ id: 1, title: "周一条目", imageUrl: null, score: 8 }] : [],
        })),
      }),
    ) as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/schedule/monday"));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<title>星期一每日放送 - Bangumi X</title>");
    expect(html).toContain('<h1 class="text-3xl font-semibold tracking-tight">每日放送</h1>');
    expect(html).not.toContain("每日放送表示每周固定编排；实际播出时间请以 Bangumi 来源为准。");
    expect(html).toContain('rel="canonical" href="https://bgmx.jaze.top/schedule/monday"');
    expect(html).toContain("2026-09-13T03:00:00.000Z");

    const invalid = await server.fetch(new Request("https://bgmx.jaze.top/schedule/funday"));
    expect(invalid.status).toBe(404);
    expect(invalid.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(await invalid.text()).toContain('name="robots" content="noindex, nofollow"');
  });

  test.each(["anime", "book", "game", "music", "real"])(
    "renders the %s annual popular route with crawlable type links",
    async (type) => {
      globalThis.fetch = mock(async () =>
        Response.json({
          page: 1,
          pageSize: 24,
          data: [
            {
              id: 42,
              title: "热门条目",
              type: "动画",
              imageUrl: null,
              score: 8,
              rank: 1,
              nsfw: false,
            },
          ],
          hasPrevious: false,
          hasNext: true,
          fetchedAt: "2026-09-13T03:00:00.000Z",
        }),
      ) as unknown as typeof fetch;

      const response = await server.fetch(new Request(`https://bgmx.jaze.top/discover/${type}`));
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(`rel="canonical" href="https://bgmx.jaze.top/discover/${type}"`);
      expect(html).toContain('href="/discover/anime"');
      expect(html).toContain('href="/discover/real"');
      expect(html).toContain('rel="next"');
    },
  );

  test("self-canonicalizes paginated and keyword discovery while noindexing search", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        page: 2,
        pageSize: 24,
        data: [],
        hasPrevious: true,
        hasNext: false,
        fetchedAt: "2026-09-13T03:00:00.000Z",
      }),
    ) as unknown as typeof fetch;

    const page = await server.fetch(new Request("https://bgmx.jaze.top/discover/anime?page=2"));
    expect(await page.text()).toContain(
      'rel="canonical" href="https://bgmx.jaze.top/discover/anime?page=2"',
    );

    const search = await server.fetch(
      new Request("https://bgmx.jaze.top/discover/anime?keyword=%E9%AB%98%E8%BE%BE"),
    );
    expect(search.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    const html = await search.text();
    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain("keyword=%E9%AB%98%E8%BE%BE");
  });

  test("returns a noindex 404 for an invalid discovery type", async () => {
    const response = await server.fetch(new Request("https://bgmx.jaze.top/discover/invalid"));
    expect(response.status).toBe(404);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    expect(await response.text()).toContain('name="robots" content="noindex, nofollow"');
  });

  test("temporarily redirects /rankings to the current year and season", async () => {
    const response = await server.fetch(new Request("https://bgmx.jaze.top/rankings"));
    expect(response.status).toBe(307);
    const location = response.headers.get("Location");
    expect(location).toMatch(/\/rankings\/\d{4}\/(winter|spring|summer|autumn)/);
  });

  test("renders valid rankings route with four season links, rank, and canonical", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        page: 1,
        pageSize: 24,
        data: [
          {
            id: 1,
            title: "经典动画",
            type: "动画",
            imageUrl: null,
            score: 8.8,
            rank: 1,
            nsfw: false,
          },
        ],
        hasPrevious: false,
        hasNext: true,
        total: 25,
        fetchedAt: "2026-09-13T03:00:00.000Z",
      }),
    ) as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/rankings/1980/winter"));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("1980 年冬季排行榜");
    expect(html).toContain('rel="canonical" href="https://bgmx.jaze.top/rankings/1980/winter"');
    expect(html).toContain('href="/rankings/1980/winter"');
    expect(html).toContain('href="/rankings/1980/spring"');
    expect(html).toContain('href="/rankings/1980/summer"');
    expect(html).toContain('href="/rankings/1980/autumn"');
    expect(html).toContain("经典动画");
    expect(html).toMatch(/#<!-- -->1|#1/);
    expect(html).toContain('rel="next"');
    expect(html).not.toContain('aria-label="面包屑"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain("/og/rankings/1980/winter");
  });

  test("renders current-year rankings without crawlable links to future quarters", async () => {
    const currentYear = new Date().getFullYear();
    globalThis.fetch = mock(async () =>
      Response.json({
        page: 1,
        pageSize: 24,
        data: [],
        hasPrevious: false,
        hasNext: false,
        total: 0,
        fetchedAt: "2026-09-13T03:00:00.000Z",
      }),
    ) as unknown as typeof fetch;

    const response = await server.fetch(
      new Request(`https://bgmx.jaze.top/rankings/${currentYear}/winter`),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(`href="/rankings/${currentYear}/winter"`);
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toContain(`href="/rankings/${currentYear + 1}/winter"`);
  });

  test("propagates 5xx upstream errors rather than masking as empty 200 list", async () => {
    globalThis.fetch = mock(
      async () =>
        new Response(JSON.stringify({ error: "Upstream failure" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        }),
    ) as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/rankings/1980/winter"));
    expect(response.status).toBe(500);
    expect(response.headers.get("X-Robots-Tag")).not.toBe("noindex, follow");
  });

  test("self-canonicalizes paginated rankings and adds rel=prev", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        page: 2,
        pageSize: 24,
        data: [
          {
            id: 25,
            title: "第二页条目",
            type: "动画",
            imageUrl: null,
            score: 8.0,
            rank: 25,
            nsfw: false,
          },
        ],
        hasPrevious: true,
        hasNext: false,
        total: 25,
        fetchedAt: "2026-09-13T03:00:00.000Z",
      }),
    ) as unknown as typeof fetch;

    const response = await server.fetch(
      new Request("https://bgmx.jaze.top/rankings/1980/winter?page=2"),
    );
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain(
      'rel="canonical" href="https://bgmx.jaze.top/rankings/1980/winter?page=2"',
    );
    expect(html).toContain("（第 2 页）");
    expect(html).toContain('rel="prev"');
  });

  test("handles empty rankings with 200 and noindex, follow", async () => {
    globalThis.fetch = mock(async () =>
      Response.json({
        page: 1,
        pageSize: 24,
        data: [],
        hasPrevious: false,
        hasNext: false,
        total: 0,
        fetchedAt: "2026-09-13T03:00:00.000Z",
      }),
    ) as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/rankings/1980/summer"));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    const html = await response.text();
    expect(html).toContain('name="robots" content="noindex, follow"');
    expect(html).toContain("暂无排行榜条目");
  });

  test.each(["/rankings/1979/winter", "/rankings/2099/winter", "/rankings/2024/rainy"])(
    "returns a noindex 404 for invalid ranking path %s",
    async (path) => {
      const response = await server.fetch(new Request(`https://bgmx.jaze.top${path}`));
      expect(response.status).toBe(404);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
      expect(await response.text()).toContain('name="robots" content="noindex, nofollow"');
    },
  );

  test("renders subject chapters at the subject URL without prefetching other relations", async () => {
    const requestedUrls: string[] = [];
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      requestedUrls.push(url);
      if (url.includes("/chapters")) {
        return Response.json({
          total: 26,
          limit: 50,
          offset: 0,
          data: [
            {
              id: 101,
              type: "本篇",
              sequence: 1,
              title: "第一话 Asteroid Blues",
              date: "1998-04-03",
              duration: "24m",
            },
          ],
        });
      }
      return Response.json({
        id: 42,
        title: "星际牛仔",
        type: "动画",
        originalTitle: "Cowboy Bebop",
        platform: "TV",
        date: "1998-04-03",
        totalChapters: 26,
        score: 9.2,
        rank: 10,
        scoreCount: 15000,
        nsfw: false,
        summary: "2071年的太空牛仔们的生活。",
        tags: ["科幻", "经典"],
        imageUrl: null,
        fetchedAt: "2026-09-13T03:00:00.000Z",
      });
    }) as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/subjects/42"));
    expect(response.status).toBe(200);
    const html = await response.text();

    expect(html).toContain("星际牛仔（动画） - Bangumi X");
    expect(html).toContain('rel="canonical" href="https://bgmx.jaze.top/subjects/42"');
    expect(html).not.toContain('aria-label="面包屑"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain('href="/"');
    expect(html).toContain('"item":"https://bgmx.jaze.top/subjects/42"');
    expect(html).not.toContain('href="/subjects/42/chapters"');
    expect(html).toContain('href="/subjects/42/characters"');
    expect(html).toContain('href="/subjects/42/persons"');
    expect(html).toContain("2071年的太空牛仔们的生活。");
    expect(html).not.toContain('<dt class="text-muted-foreground">章节</dt>');
    expect(html).toContain('tabular-nums">26</span>');
    expect(html.indexOf(">评分</dt>")).toBeLessThan(html.indexOf(">排名</dt>"));
    expect(html.indexOf(">排名</dt>")).toBeLessThan(html.indexOf(">日期</dt>"));
    expect(html.indexOf(">日期</dt>")).toBeLessThan(html.indexOf(">平台</dt>"));
    expect(html).toContain('"@type":"TVSeries"');
    expect(html).toContain('"@type":"AggregateRating"');
    expect(html).toContain('"ratingCount":15000');
    expect(html).toContain("第一话 Asteroid Blues");
    expect(html).toContain('href="/chapters/101"');

    expect(requestedUrls.some((u) => u.includes("/chapters"))).toBe(true);
    expect(requestedUrls.some((u) => u.includes("/characters"))).toBe(false);
    expect(requestedUrls.some((u) => u.includes("/persons"))).toBe(false);
  });

  test("renders paginated chapters at the subject URL and removes the chapters subroute", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/chapters")) {
        return Response.json({
          total: 76,
          limit: 50,
          offset: 50,
          data: [
            {
              id: 101,
              type: "本篇",
              sequence: 51,
              title: "第五十一话",
              date: "1999-04-03",
              duration: "24m",
            },
          ],
        });
      }
      return Response.json({
        id: 42,
        title: "星际牛仔",
        type: "动画",
        score: 9.0,
        nsfw: false,
        summary: null,
        tags: [],
        imageUrl: null,
      });
    }) as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/subjects/42?page=2"));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain('rel="canonical" href="https://bgmx.jaze.top/subjects/42?page=2"');
    expect(html).not.toContain('aria-label="面包屑"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).not.toContain('href="/subjects/42/chapters"');
    expect(html).toContain('"sameAs":"https://bgm.tv/subject/42/ep"');
    expect(html).toContain('"isBasedOn":"https://bgm.tv/subject/42/ep"');
    expect(html).toContain('"url":"https://bgmx.jaze.top/chapters/101"');
    expect(html).toContain("第五十一话");
    expect(html).toContain('href="/chapters/101"');

    const removed = await server.fetch(new Request("https://bgmx.jaze.top/subjects/42/chapters"));
    expect(removed.status).toBe(404);
    expect(removed.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  test("renders subject characters and persons subroutes with standard detail links", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/characters")) {
        return Response.json({
          total: 1,
          groups: [
            {
              relation: "主角",
              items: [
                {
                  id: 201,
                  name: "斯派克",
                  type: "角色",
                  imageUrl: null,
                  actors: [{ id: 301, name: "山寺宏一", type: "个人" }],
                },
              ],
            },
          ],
        });
      }
      if (url.includes("/persons")) {
        return Response.json({
          total: 1,
          groups: [
            {
              relation: "导演",
              items: [
                {
                  id: 302,
                  name: "渡边信一郎",
                  type: "个人",
                  careers: ["导演"],
                  chapters: null,
                  imageUrl: null,
                },
              ],
            },
          ],
        });
      }
      return Response.json({
        id: 42,
        title: "星际牛仔",
        type: "动画",
        score: 9.0,
        nsfw: false,
        summary: null,
        tags: [],
        imageUrl: null,
      });
    }) as unknown as typeof fetch;

    const charResponse = await server.fetch(
      new Request("https://bgmx.jaze.top/subjects/42/characters"),
    );
    expect(charResponse.status).toBe(200);
    const charHtml = await charResponse.text();
    expect(charHtml).toContain('tabular-nums">1</span>');
    expect(charHtml).toContain(
      'rel="canonical" href="https://bgmx.jaze.top/subjects/42/characters"',
    );
    expect(charHtml).not.toContain('aria-label="面包屑"');
    expect(charHtml).toContain('"@type":"BreadcrumbList"');
    expect(charHtml).toContain('href="/subjects/42/characters"');
    expect(charHtml.match(/aria-current="page"/g)).toHaveLength(1);
    expect(charHtml).toContain('"sameAs":"https://bgm.tv/subject/42/characters"');
    expect(charHtml).toContain('"isBasedOn":"https://bgm.tv/subject/42/characters"');
    expect(charHtml).toContain('"@type":"Person"');
    expect(charHtml).toContain("斯派克");
    expect(charHtml).toContain('href="/characters/201"');

    const personResponse = await server.fetch(
      new Request("https://bgmx.jaze.top/subjects/42/persons"),
    );
    expect(personResponse.status).toBe(200);
    const personHtml = await personResponse.text();
    expect(personHtml).toContain('tabular-nums">1</span>');
    expect(personHtml).toContain(
      'rel="canonical" href="https://bgmx.jaze.top/subjects/42/persons"',
    );
    expect(personHtml).not.toContain('aria-label="面包屑"');
    expect(personHtml).toContain('"@type":"BreadcrumbList"');
    expect(personHtml).toContain('href="/subjects/42/persons"');
    expect(personHtml.match(/aria-current="page"/g)).toHaveLength(1);
    expect(personHtml).toContain('"sameAs":"https://bgm.tv/subject/42/persons"');
    expect(personHtml).toContain('"isBasedOn":"https://bgm.tv/subject/42/persons"');
    expect(personHtml).toContain('"@type":"Person"');
    expect(personHtml).toContain("渡边信一郎");
    expect(personHtml).toContain('href="/persons/302"');
  });

  test("marks NSFW subject and its subroutes as noindex, follow", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.pathname === "/subjects/69/chapters") {
        return Response.json({ total: 0, limit: 50, offset: 0, data: [] });
      }
      return Response.json({
        id: 69,
        title: "成人条目",
        type: "动画",
        score: null,
        nsfw: true,
        summary: null,
        tags: [],
        imageUrl: null,
      });
    }) as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/subjects/69"));
    expect(response.status).toBe(200);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    const html = await response.text();
    expect(html).toContain('name="robots" content="noindex, follow"');
  });

  test("returns a noindex 404 for nonexistent subject and invalid subroutes", async () => {
    globalThis.fetch = mock(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/subjects/999999"));
    expect(response.status).toBe(404);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");

    const invalid = await server.fetch(
      new Request("https://bgmx.jaze.top/subjects/42/invalid-tab"),
    );
    expect(invalid.status).toBe(404);
    expect(invalid.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  test("renders qualified chapter detail with TVEpisode schema and parent subject link", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/chapters/10")) {
        return Response.json({
          id: 10,
          subject: { id: 42, title: "星际牛仔", type: "动画", nsfw: false },
          type: "本篇",
          sequence: 10,
          title: "冥王星航线",
          date: "1998-05-15",
          duration: "24m",
          summary: "这一话的精彩剧情介绍。",
          fetchedAt: "2026-09-13T03:00:00.000Z",
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    const response = await server.fetch(new Request("https://bgmx.jaze.top/chapters/10"));
    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("冥王星航线 - 星际牛仔 - Bangumi X");
    expect(html).toContain('rel="canonical" href="https://bgmx.jaze.top/chapters/10"');
    expect(html).toContain('name="robots" content="index, follow"');
    expect(html).not.toContain('aria-label="面包屑"');
    expect(html).toContain('"@type":"BreadcrumbList"');
    expect(html).toContain("这一话的精彩剧情介绍。");
    expect(html).toContain('href="/subjects/42"');
    expect(html).not.toContain('href="/subjects/42/chapters"');
    expect(html).not.toContain('href="/chapters/9"');
    expect(html).not.toContain('href="/chapters/11"');
    expect(html).toContain('"@type":"TVEpisode"');
    expect(html).toContain('"isPartOf"');
    expect(html).toContain('"@type":"TVSeries"');
  });

  test("flags thin chapter and NSFW parent subject as noindex, follow", async () => {
    // 1. Thin chapter (no summary, no date)
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/chapters/11")) {
        return Response.json({
          id: 11,
          subject: { id: 42, title: "普通条目", type: "动画", nsfw: false },
          type: "本篇",
          sequence: 11,
          title: "薄章节标题",
          date: null,
          duration: null,
          summary: null,
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    const thin = await server.fetch(new Request("https://bgmx.jaze.top/chapters/11"));
    expect(thin.status).toBe(200);
    expect(thin.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    const thinHtml = await thin.text();
    expect(thinHtml).toContain('name="robots" content="noindex, follow"');
    expect(thinHtml).toContain('href="/subjects/42"');
    expect(thinHtml).not.toContain('href="/subjects/42/chapters"');

    // 2. Chapter of an NSFW parent subject
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/chapters/12")) {
        return Response.json({
          id: 12,
          subject: { id: 69, title: "成人动画", type: "动画", nsfw: true },
          type: "本篇",
          sequence: 1,
          title: "有简介但属于成人条目",
          date: "2026-01-01",
          duration: "30m",
          summary: "成人动画章节简介",
        });
      }
      throw new Error(`Unexpected request: ${url}`);
    }) as unknown as typeof fetch;

    const nsfw = await server.fetch(new Request("https://bgmx.jaze.top/chapters/12"));
    expect(nsfw.status).toBe(200);
    expect(nsfw.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    expect(await nsfw.text()).toContain('name="robots" content="noindex, follow"');
  });

  test("returns 404 for a missing chapter", async () => {
    globalThis.fetch = mock(
      async () => new Response(null, { status: 404 }),
    ) as unknown as typeof fetch;
    const response = await server.fetch(new Request("https://bgmx.jaze.top/chapters/10"));
    expect(response.status).toBe(404);
    expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  test.each([
    ["characters", "201", "斯派克", "角色", "Person", "persons", "山寺宏一"],
    ["characters", "202", "红龙会", "组织", "Organization", "persons", "制作公司"],
    ["characters", "203", "剑鱼II", "机体", "Thing", "persons", "设计者"],
    ["characters", "204", "比博普号", "舰船", "Thing", "persons", "舰长"],
    ["persons", "301", "山寺宏一", "个人", "Person", "characters", "斯派克"],
    ["persons", "302", "日升", "公司", "Organization", "characters", "高达"],
    ["persons", "303", "虚构乐队", "组合", "Organization", "characters", "主唱"],
  ] as const)(
    "renders qualified %s/%s with crawlable relations and %s schema",
    async (kind, id, name, type, schemaType, secondaryPath, secondaryName) => {
      globalThis.fetch = mock(async (input: string | URL | Request) => {
        const url = input instanceof Request ? input.url : String(input);
        if (url.endsWith(`/${secondaryPath}`)) {
          return Response.json({
            total: 1,
            groups: [
              {
                relation: "关联",
                items: [
                  kind === "characters"
                    ? {
                        id: 301,
                        name: secondaryName,
                        type: "个人",
                        relation: "配音",
                        imageUrl: null,
                        subject: { id: 42, title: "星际牛仔", type: "动画" },
                      }
                    : {
                        id: 201,
                        name: secondaryName,
                        type: "角色",
                        relation: "配音",
                        imageUrl: null,
                        subject: { id: 42, title: "星际牛仔", type: "动画" },
                      },
                ],
              },
            ],
            fetchedAt: "2026-09-13T03:00:00.000Z",
          });
        }
        if (url.endsWith("/subjects")) {
          return Response.json({
            total: 1,
            groups: [
              {
                relation: "关联",
                items: [
                  {
                    id: 42,
                    title: "星际牛仔",
                    type: "动画",
                    relation: "主角",
                    chapters: null,
                    imageUrl: null,
                  },
                ],
              },
            ],
            fetchedAt: "2026-09-13T03:00:00.000Z",
          });
        }
        return Response.json({
          id: Number(id),
          name,
          type,
          careers: kind === "persons" ? ["声优"] : undefined,
          gender: null,
          birthday: null,
          bloodType: null,
          summary: "可验证的实体简介。",
          imageUrl: null,
          fetchedAt: "2026-09-13T03:00:00.000Z",
        });
      }) as unknown as typeof fetch;

      const response = await server.fetch(
        new Request(`https://bgmx.jaze.top/${kind}/${id}?tab=${secondaryPath}`),
      );
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(
        `<title>${name}（${type === "角色" || type === "组织" || type === "机体" || type === "舰船" ? "角色" : "人物"}） - Bangumi X</title>`,
      );
      expect(html).toContain(`rel="canonical" href="https://bgmx.jaze.top/${kind}/${id}"`);
      expect(html).toContain('name="robots" content="index, follow"');
      expect(html).not.toContain('aria-label="面包屑"');
      expect(html).toContain('"@type":"BreadcrumbList"');
      expect(html).not.toContain('href="/subjects/42"');
      expect(html).toContain(
        kind === "characters" ? 'href="/persons/301"' : 'href="/characters/201"',
      );
      expect(html).toContain(secondaryName);
      expect(html).toContain(`"@type":"${schemaType}"`);
      expect(html).toContain(
        `"sameAs":"https://bgm.tv/${kind === "characters" ? "character" : "person"}/${id}"`,
      );
      expect(html).toContain("2026-09-13T03:00:00.000Z");
    },
  );

  test("noindexes thin entities and returns 404 for invalid or missing entity IDs", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("/999")) return new Response(null, { status: 404 });
      if (url.endsWith("/subjects") || url.endsWith("/persons") || url.endsWith("/characters")) {
        return Response.json({
          total: 0,
          groups: [],
          fetchedAt: "2026-09-13T03:00:00.000Z",
        });
      }
      return Response.json({
        id: 201,
        name: "未命名角色",
        type: "角色",
        gender: null,
        birthday: null,
        bloodType: null,
        summary: null,
        imageUrl: null,
        fetchedAt: "2026-09-13T03:00:00.000Z",
      });
    }) as unknown as typeof fetch;

    const thin = await server.fetch(new Request("https://bgmx.jaze.top/characters/201"));
    expect(thin.status).toBe(200);
    expect(thin.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    expect(await thin.text()).toContain('name="robots" content="noindex, follow"');

    for (const path of ["/characters/nope", "/persons/0", "/characters/999", "/persons/999"]) {
      const response = await server.fetch(new Request(`https://bgmx.jaze.top${path}`));
      expect(response.status).toBe(404);
      expect(response.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
    }
  });

  test("judges entity indexability by subject relations regardless of the active tab", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.endsWith("/subjects")) {
        return Response.json({
          total: 1,
          groups: [
            {
              relation: "主角",
              items: [
                {
                  id: 42,
                  title: "星际牛仔",
                  type: "动画",
                  relation: "主角",
                  chapters: null,
                  imageUrl: null,
                },
              ],
            },
          ],
        });
      }
      if (url.endsWith("/persons")) return Response.json({ total: 0, groups: [] });
      return Response.json({
        id: 201,
        name: "斯派克",
        type: "角色",
        gender: null,
        birthday: null,
        bloodType: null,
        summary: null,
        imageUrl: null,
      });
    }) as unknown as typeof fetch;

    for (const query of ["", "?tab=persons"]) {
      const response = await server.fetch(
        new Request(`https://bgmx.jaze.top/characters/201${query}`),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("X-Robots-Tag")).toBeNull();
      expect(await response.text()).toContain('name="robots" content="index, follow"');
    }
  });

  test("noindexes two-item public lists and returns 404 for withdrawn lists", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url.includes("withdrawn")) return new Response(null, { status: 404 });
      return Response.json({
        name: "两项清单",
        ownerName: "Alice",
        updatedAt: "2026-09-12T03:00:00.000Z",
        page: 1,
        pageSize: 24,
        data: [1, 2].map((id) => ({
          id,
          title: `条目 ${id}`,
          type: "动画",
          imageUrl: null,
          nsfw: false,
        })),
        hasPrevious: false,
        hasNext: false,
        total: 2,
      });
    }) as unknown as typeof fetch;

    const thin = await server.fetch(new Request("https://bgmx.jaze.top/s/two-items"));
    expect(thin.status).toBe(200);
    expect(thin.headers.get("X-Robots-Tag")).toBe("noindex, follow");
    const thinHtml = await thin.text();
    expect(thinHtml).toContain('name="robots" content="noindex, follow"');
    expect(thinHtml).not.toContain('"@type":"ItemList"');

    const withdrawn = await server.fetch(new Request("https://bgmx.jaze.top/s/withdrawn"));
    expect(withdrawn.status).toBe(404);
    expect(withdrawn.headers.get("Cache-Control")).toContain("no-store");
    expect(withdrawn.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
  });

  test("server-renders public collection lists with publication threshold and pagination", async () => {
    globalThis.fetch = mock(async (input: string | URL | Request) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      const page = Number(url.searchParams.get("page"));
      return Response.json({
        name: "科幻精选",
        ownerName: "Alice",
        updatedAt: "2026-09-12T03:00:00.000Z",
        page,
        pageSize: 24,
        data: [1, 2, 3].map((id) => ({
          id: id + (page - 1) * 24,
          title: `条目 ${id}`,
          type: "动画",
          imageUrl: null,
          nsfw: false,
        })),
        hasPrevious: page > 1,
        hasNext: page === 1,
        total: 27,
      });
    }) as unknown as typeof fetch;

    const first = await server.fetch(new Request("https://bgmx.jaze.top/s/public-token"));
    expect(first.status).toBe(200);
    expect(first.headers.get("Cache-Control")).toBe("public, max-age=300");
    const firstHtml = await first.text();
    expect(firstHtml).toContain("科幻精选");
    expect(firstHtml).toContain("由 Alice 分享");
    expect(firstHtml).toContain("2026年9月12日 11:00");
    expect(firstHtml).toContain('href="/subjects/1"');
    expect(firstHtml).toContain('rel="canonical" href="https://bgmx.jaze.top/s/public-token"');
    expect(firstHtml).toContain('rel="next"');
    expect(firstHtml).toContain('"@type":"ItemList"');

    const second = await server.fetch(new Request("https://bgmx.jaze.top/s/public-token?page=2"));
    const secondHtml = await second.text();
    expect(secondHtml).toContain(
      'rel="canonical" href="https://bgmx.jaze.top/s/public-token?page=2"',
    );
    expect(secondHtml).toContain('rel="prev"');
  });

  describe("Machine Discovery: robots.txt, llms.txt & chunked sitemaps", () => {
    test("serves dynamic robots.txt with crawler categorization, sources, and sitemap reference", async () => {
      const response = await server.fetch(new Request("https://bgmx.jaze.top/robots.txt"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=86400, stale-while-revalidate=604800",
      );

      const text = await response.text();
      expect(text).toContain("Sitemap: https://bgmx.jaze.top/sitemap.xml");

      // Traditional search bots allowed
      expect(text).toContain("User-agent: Googlebot\nAllow: /");
      expect(text).toContain("User-agent: Bingbot\nAllow: /");
      expect(text).toContain("User-agent: Baiduspider\nAllow: /");

      // AI Search bots allowed for GEO citations
      expect(text).toContain("User-agent: OAI-SearchBot\nAllow: /");
      expect(text).toContain("User-agent: ChatGPT-User\nAllow: /");
      expect(text).toContain("User-agent: PerplexityBot\nAllow: /");

      // AI training bots disallowed
      expect(text).toContain("User-agent: GPTBot\nDisallow: /");
      expect(text).toContain("User-agent: ClaudeBot\nDisallow: /");
      expect(text).toContain("User-agent: Google-Extended\nDisallow: /");
      expect(text).toContain("User-agent: CCBot\nDisallow: /");
      expect(text).toContain("User-agent: Bytespider\nDisallow: /");

      // Does NOT disallow /collections or /progress so meta noindex takes effect
      expect(text).not.toContain("Disallow: /collections");
      expect(text).not.toContain("Disallow: /progress");

      // Disallows internal endpoints
      expect(text).toContain("Disallow: /_server/");
      expect(text).toContain("Disallow: /api/auth/");
    });

    test("serves standard llms.txt with public routes, license, and training denial", async () => {
      const response = await server.fetch(new Request("https://bgmx.jaze.top/llms.txt"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=86400, stale-while-revalidate=604800",
      );

      const text = await response.text();
      expect(text).toContain("# Bangumi X");
      expect(text).toContain("https://bgmx.jaze.top/sitemap.xml");
      expect(text).toContain("Bangumi 番组计划");
      expect(text).toContain("CC BY-SA 3.0");
      expect(text).toContain("Jazee6");
      expect(text).toContain("https://github.com/Jazee6/bangumi-x");
      expect(text).toContain("未授权模型训练抓取");
    });

    test("serves sitemap index (/sitemap.xml) pointing to the 6 chunked sub-sitemaps", async () => {
      const response = await server.fetch(new Request("https://bgmx.jaze.top/sitemap.xml"));

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=86400, stale-while-revalidate=604800",
      );

      const xml = await response.text();
      expect(validateXmlWellFormedness(xml)).toEqual({ valid: true });
      expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
      expect(xml).toContain("<loc>https://bgmx.jaze.top/sitemap/static.xml</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/sitemap/subjects.xml</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/sitemap/chapters.xml</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/sitemap/characters.xml</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/sitemap/persons.xml</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/sitemap/collections.xml</loc>");
    });

    test("generates /sitemap/static.xml with static pages and verified historical rankings", async () => {
      globalThis.fetch = mock(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        expect(url.pathname).toBe("/directory");
        expect(url.searchParams.get("type")).toBe("ranking");
        expect(url.searchParams.get("status")).toBe("index");
        return Response.json({
          resourceType: "ranking",
          entries: [
            {
              externalId: "2025/winter",
              lastVerifiedAt: "2026-02-01T12:00:00.000Z",
            }, // slash delimiter from Server
            {
              externalId: "2024:spring",
              lastVerifiedAt: "2026-02-01T12:00:00.000Z",
            }, // colon delimiter fallback
            {
              externalId: "1979/winter",
              lastVerifiedAt: "2026-02-01T12:00:00.000Z",
            }, // < 1980 excluded
            {
              externalId: "2099/summer",
              lastVerifiedAt: "2026-02-01T12:00:00.000Z",
            }, // future excluded
          ],
          nextCursor: null,
        });
      }) as unknown as typeof fetch;

      const response = await server.fetch(
        new Request("https://bgmx.jaze.top/sitemap/static.xml", {
          headers: { "x-test-now": "2026-03-15T00:00:00.000Z" },
        }),
      );

      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toBe("application/xml; charset=utf-8");
      expect(response.headers.get("Cache-Control")).toBe(
        "public, max-age=86400, stale-while-revalidate=604800",
      );

      const xml = await response.text();
      expect(validateXmlWellFormedness(xml)).toEqual({ valid: true });
      expect(xml).toContain("<loc>https://bgmx.jaze.top/</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/schedule/monday</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/discover/anime</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/about</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/privacy</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/terms</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/rankings/2025/winter</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/rankings/2024/spring</loc>");
      expect(xml).toContain("<lastmod>2026-02-01T12:00:00.000Z</lastmod>");

      // Out of range rankings excluded
      expect(xml).not.toContain("1979");
      expect(xml).not.toContain("2099");
    });

    test("generates /sitemap/subjects.xml consuming cursors across multi-page directory results", async () => {
      globalThis.fetch = mock(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        expect(url.pathname).toBe("/directory");
        expect(url.searchParams.get("type")).toBe("subject");
        const cursor = url.searchParams.get("cursor");
        if (!cursor) {
          return Response.json({
            resourceType: "subject",
            entries: [{ externalId: "101", lastVerifiedAt: "2026-03-10T08:00:00.000Z" }],
            nextCursor: "101",
          });
        }
        return Response.json({
          resourceType: "subject",
          entries: [{ externalId: "102", lastVerifiedAt: "2026-03-11T08:00:00.000Z" }],
          nextCursor: null,
        });
      }) as unknown as typeof fetch;

      const response = await server.fetch(
        new Request("https://bgmx.jaze.top/sitemap/subjects.xml"),
      );
      expect(response.status).toBe(200);
      const xml = await response.text();
      expect(validateXmlWellFormedness(xml)).toEqual({ valid: true });
      // Both cursor pages consumed
      expect(xml).toContain("<loc>https://bgmx.jaze.top/subjects/101</loc>");
      expect(xml).not.toContain("<loc>https://bgmx.jaze.top/subjects/101/chapters</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/subjects/102</loc>");
      expect(xml).toContain("<loc>https://bgmx.jaze.top/subjects/102/persons</loc>");
      expect(xml).toContain("<lastmod>2026-03-10T08:00:00.000Z</lastmod>");
      expect(xml).toContain("<lastmod>2026-03-11T08:00:00.000Z</lastmod>");
    });

    test("generates /sitemap/chapters.xml, /characters.xml, /persons.xml, and /collections.xml", async () => {
      globalThis.fetch = mock(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        const type = url.searchParams.get("type");
        const idMap: Record<string, string> = {
          chapter: "1001",
          character: "2001",
          person: "3001",
          collection_list: "share-xyz",
        };
        return Response.json({
          resourceType: type,
          entries: [
            {
              externalId: idMap[type || ""] || "1",
              lastVerifiedAt: "2026-03-12T00:00:00.000Z",
            },
          ],
          nextCursor: null,
        });
      }) as unknown as typeof fetch;

      const chaptersRes = await server.fetch(
        new Request("https://bgmx.jaze.top/sitemap/chapters.xml"),
      );
      expect(chaptersRes.status).toBe(200);
      const chaptersXml = await chaptersRes.text();
      expect(validateXmlWellFormedness(chaptersXml)).toEqual({ valid: true });
      expect(chaptersXml).toContain("<loc>https://bgmx.jaze.top/chapters/1001</loc>");

      const charactersRes = await server.fetch(
        new Request("https://bgmx.jaze.top/sitemap/characters.xml"),
      );
      expect(charactersRes.status).toBe(200);
      const charactersXml = await charactersRes.text();
      expect(validateXmlWellFormedness(charactersXml)).toEqual({ valid: true });
      expect(charactersXml).toContain("<loc>https://bgmx.jaze.top/characters/2001</loc>");

      const personsRes = await server.fetch(
        new Request("https://bgmx.jaze.top/sitemap/persons.xml"),
      );
      expect(personsRes.status).toBe(200);
      const personsXml = await personsRes.text();
      expect(validateXmlWellFormedness(personsXml)).toEqual({ valid: true });
      expect(personsXml).toContain("<loc>https://bgmx.jaze.top/persons/3001</loc>");

      const collectionsRes = await server.fetch(
        new Request("https://bgmx.jaze.top/sitemap/collections.xml"),
      );
      expect(collectionsRes.status).toBe(200);
      const collectionsXml = await collectionsRes.text();
      expect(validateXmlWellFormedness(collectionsXml)).toEqual({
        valid: true,
      });
      expect(collectionsXml).toContain("<loc>https://bgmx.jaze.top/s/share-xyz</loc>");
    });

    test("returns 502 with no-store when sub-sitemap Server directory query fails", async () => {
      globalThis.fetch = mock(async () => {
        return new Response("Server error", { status: 500 });
      }) as unknown as typeof fetch;

      const response = await server.fetch(
        new Request("https://bgmx.jaze.top/sitemap/subjects.xml"),
      );
      expect(response.status).toBe(502);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  describe("Canonical redirects, cache hierarchy & image performance", () => {
    test("permanently redirects non-canonical hosts to canonical origin with 301", async () => {
      const response = await server.fetch(new Request("https://www.bgmx.jaze.top/about"));
      expect(response.status).toBe(301);
      expect(response.headers.get("Location")).toBe("https://bgmx.jaze.top/about");
    });

    test("does not self-redirect canonical requests behind an HTTP edge proxy", async () => {
      const response = await server.fetch(new Request("http://bgmx.jaze.top/about"));
      expect(response.status).toBe(200);
      expect(response.headers.get("Location")).toBeNull();

      const edgeoneRoot = resolve(webRoot, ".edgeone");
      const { default: handler } = (await import(
        `${pathToFileURL(resolve(edgeoneRoot, "cloud-functions/ssr-node/handler.js")).href}?test=${Date.now()}`
      )) as {
        default: (request: {
          method: string;
          url: string;
          headers: Record<string, string>;
        }) => Promise<Response>;
      };
      const edgeResponse = await handler({
        method: "GET",
        url: "/about",
        headers: { host: "bgmx.jaze.top" },
      });
      expect(edgeResponse.status).toBe(200);
      expect(edgeResponse.headers.get("Location")).toBeNull();
    });

    test("permanently normalizes duplicate consecutive slashes with 301 or 308", async () => {
      const response = await server.fetch(new Request("https://bgmx.jaze.top//schedule/monday"));
      expect([301, 308]).toContain(response.status);
      expect(response.headers.get("Location")).toBe("https://bgmx.jaze.top/schedule/monday");
    });

    test("preserves 307 temporary redirect for /rankings", async () => {
      const response = await server.fetch(new Request("https://bgmx.jaze.top/rankings"));
      expect(response.status).toBe(307);
      expect(response.headers.get("Location")).toMatch(
        /^\/rankings\/\d{4}\/(winter|spring|summer|autumn)$/,
      );
    });

    test("delivers hierarchical Cache-Control across HTML, machines and private routes", async () => {
      globalThis.fetch = mock(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.pathname === "/schedule") {
          return Response.json({
            fetchedAt: "2026-09-13T03:00:00.000Z",
            days: Array.from({ length: 7 }, (_, i) => ({
              weekday: i + 1,
              items: [
                {
                  id: 42,
                  title: "测试动画",
                  imageUrl: "https://lain.bgm.tv/pic/cover/l/42.jpg",
                  score: 8,
                },
              ],
            })),
          });
        }
        if (url.pathname === "/rankings") {
          return Response.json({
            page: 1,
            pageSize: 24,
            data: [{ id: 42, title: "测试动画", rank: 1, score: 8, nsfw: false }],
            hasPrevious: false,
            hasNext: false,
          });
        }
        if (url.pathname === "/subjects/42/chapters") {
          return Response.json({ total: 0, limit: 50, offset: 0, data: [] });
        }
        if (url.pathname === "/subjects/42") {
          return Response.json({
            id: 42,
            title: "测试动画",
            type: "动画",
            summary: "动画简介",
            imageUrl: "https://lain.bgm.tv/pic/cover/l/42.jpg",
            score: 8.5,
            nsfw: false,
            date: "2024-01-01",
            tags: [],
          });
        }
        if (url.pathname.startsWith("/discover")) {
          return Response.json({
            page: 1,
            pageSize: 24,
            data: [{ id: 42, title: "热门动画", rank: 1, score: 8, nsfw: false }],
            hasPrevious: false,
            hasNext: false,
          });
        }
        return Response.json({});
      }) as unknown as typeof fetch;

      // Home (1h max-age)
      const home = await server.fetch(new Request("https://bgmx.jaze.top/"));
      expect(home.headers.get("Cache-Control")).toBe(
        "public, max-age=3600, stale-while-revalidate=86400",
      );

      // Weekday (1h max-age)
      const weekday = await server.fetch(new Request("https://bgmx.jaze.top/schedule/monday"));
      expect(weekday.headers.get("Cache-Control")).toBe(
        "public, max-age=3600, stale-while-revalidate=86400",
      );

      // Rankings (24h max-age)
      const rankings = await server.fetch(
        new Request("https://bgmx.jaze.top/rankings/2026/winter"),
      );
      expect(rankings.headers.get("Cache-Control")).toBe(
        "public, max-age=86400, stale-while-revalidate=604800",
      );

      // Annual popular (24h max-age)
      const popular = await server.fetch(new Request("https://bgmx.jaze.top/discover/anime"));
      expect(popular.headers.get("Cache-Control")).toBe(
        "public, max-age=86400, stale-while-revalidate=604800",
      );

      // Subject detail (1h max-age, shorter than the Server data cache)
      const subject = await server.fetch(new Request("https://bgmx.jaze.top/subjects/42"));
      expect(subject.headers.get("Cache-Control")).toBe(
        "public, max-age=3600, stale-while-revalidate=86400",
      );

      // Private routes (no-store)
      const collections = await server.fetch(new Request("https://bgmx.jaze.top/collections"));
      expect(collections.headers.get("Cache-Control")).toContain("no-store");

      const progress = await server.fetch(new Request("https://bgmx.jaze.top/progress"));
      expect(progress.headers.get("Cache-Control")).toContain("no-store");
    });

    test("sets eager loading and high fetch priority on detail hero image while keeping list covers lazy", async () => {
      globalThis.fetch = mock(async (input: string | URL | Request) => {
        const url = new URL(input instanceof Request ? input.url : String(input));
        if (url.pathname === "/subjects/42/chapters") {
          return Response.json({ total: 0, limit: 50, offset: 0, data: [] });
        }
        if (url.pathname === "/subjects/42") {
          return Response.json({
            id: 42,
            title: "星际牛仔",
            type: "动画",
            summary: "赏金猎人故事",
            imageUrl: "https://lain.bgm.tv/pic/cover/l/42.jpg",
            score: 9.2,
            nsfw: false,
            tags: [],
          });
        }
        if (url.pathname === "/schedule") {
          return Response.json({
            fetchedAt: "2026-09-13T03:00:00.000Z",
            days: [
              {
                weekday: 1,
                items: [
                  {
                    id: 42,
                    title: "星际牛仔",
                    imageUrl: "https://lain.bgm.tv/pic/cover/l/42.jpg",
                    score: 9.2,
                  },
                ],
              },
            ],
          });
        }
        return Response.json({});
      }) as unknown as typeof fetch;

      // Subject detail hero image
      const subjectRes = await server.fetch(new Request("https://bgmx.jaze.top/subjects/42"));
      expect(subjectRes.status).toBe(200);
      const subjectHtml = await subjectRes.text();
      expect(subjectHtml).toMatch(
        /<img[^>]+src="https:\/\/lain\.bgm\.tv\/pic\/cover\/l\/42\.jpg"[^>]+loading="eager"[^>]+fetchPriority="high"/,
      );

      // Home list cover image (lazy)
      const homeRes = await server.fetch(new Request("https://bgmx.jaze.top/"));
      expect(homeRes.status).toBe(200);
      const homeHtml = await homeRes.text();
      expect(homeHtml).toMatch(
        /<img[^>]+src="https:\/\/lain\.bgm\.tv\/pic\/cover\/l\/42\.jpg"[^>]+loading="lazy"/,
      );
    });
  });
});
