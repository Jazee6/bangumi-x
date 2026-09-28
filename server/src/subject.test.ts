import { describe, expect, test } from "vitest";

import { normalizeSubject } from "./subject";

describe("normalizeSubject", () => {
  test("turns a complete upstream subject into the public detail contract", () => {
    expect(
      normalizeSubject(
        {
          id: 4242,
          type: 2,
          name: "Original title",
          name_cn: "中文标题",
          platform: "TV",
          date: "2026-04-01",
          eps: 12,
          rating: { score: 8.25, rank: 123, total: 4567 },
          nsfw: true,
          summary: "第一行\n第二行",
          tags: [{ name: "科幻" }, { name: "原创" }],
          images: {
            large: "https://lain.bgm.tv/pic/cover/l/ab/cd/4242.jpg",
          },
        },
        "https://server.example.test",
      ),
    ).toEqual({
      id: 4242,
      title: "中文标题",
      type: "动画",
      originalTitle: "Original title",
      platform: "TV",
      date: "2026-04-01",
      totalChapters: 12,
      score: 8.25,
      rank: 123,
      scoreCount: 4567,
      nsfw: true,
      summary: "第一行\n第二行",
      tags: ["科幻", "原创"],
      imageUrl:
        "https://server.example.test/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fl%2Fab%2Fcd%2F4242.jpg&size=large",
      broadcast: null,
    });
  });

  test("applies stable fallbacks and discards invalid optional values", () => {
    expect(
      normalizeSubject(
        {
          id: 7,
          name: "  Original title  ",
          name_cn: " ",
          platform: 2,
          date: " ",
          total_chapters: -1,
          rating: { score: Number.POSITIVE_INFINITY, rank: 0 },
          nsfw: "true",
          summary: null,
          tags: [{ name: "  动画  " }, { name: " " }, null, { value: "invalid" }],
          images: { large: "https://example.com/pic/cover/l/7.jpg" },
        },
        "https://server.example.test",
      ),
    ).toEqual({
      id: 7,
      title: "Original title",
      type: "其他",
      originalTitle: null,
      platform: null,
      date: null,
      totalChapters: null,
      score: null,
      rank: null,
      scoreCount: null,
      nsfw: false,
      summary: null,
      tags: ["动画"],
      imageUrl: null,
      broadcast: null,
    });
  });

  test("returns at most ten valid tags", () => {
    const tags = Array.from({ length: 12 }, (_, index) => ({ name: `标签${index + 1}` }));

    expect(normalizeSubject({ id: 8, tags }, "https://server.example.test").tags).toEqual(
      tags.slice(0, 10).map((tag) => tag.name),
    );
  });

  test("uses the unnamed fallback and rejects an invalid subject identity", () => {
    expect(
      normalizeSubject({ id: 9, name: "", name_cn: "" }, "https://server.example.test"),
    ).toMatchObject({
      id: 9,
      title: "未命名条目",
      originalTitle: null,
    });

    expect(() => normalizeSubject({ id: 0 }, "https://server.example.test")).toThrow();
    expect(() => normalizeSubject(null, "https://server.example.test")).toThrow();
  });
});
