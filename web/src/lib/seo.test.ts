import { describe, expect, test } from "bun:test";

import {
  buildEntityDescription,
  buildPageHead,
  buildSubjectDescription,
  coverShareImage,
  getEntityDisplayName,
  withOriginalName,
} from "./seo";

describe("page social metadata", () => {
  test("omits Open Graph and Twitter metadata when the image is explicitly null", () => {
    const head = buildPageHead({
      title: "搜索结果",
      canonicalPath: "/discover/anime?keyword=test",
      publication: { state: "noindex-follow", reason: "keyword-search" },
      image: null,
    });

    expect(head.meta.some((item) => "property" in item && item.property === "og:image")).toBe(
      false,
    );
    expect(head.meta.some((item) => "name" in item && item.name === "twitter:image")).toBe(false);
    expect(head.links).toEqual([
      {
        rel: "canonical",
        href: "https://bgmx.jaze.top/discover/anime?keyword=test",
      },
    ]);
  });

  test("uses the brand image by default for public pages", () => {
    const head = buildPageHead();

    expect(head.meta).toContainEqual(
      expect.objectContaining({
        property: "og:image",
        content: "https://bgmx.jaze.top/og-brand.png",
      }),
    );
    expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary_large_image" });
  });

  test("uses a cover as a summary card without brand dimensions", () => {
    const cover = "https://s.bgmx.jaze.top/images?url=cover&size=large";
    const head = buildPageHead({ image: cover });

    expect(head.meta).toContainEqual({ property: "og:image", content: cover });
    expect(head.meta).toContainEqual({ name: "twitter:card", content: "summary" });
    expect(head.meta.some((item) => "property" in item && item.property === "og:image:width")).toBe(
      false,
    );
  });

  test("never shares NSFW covers", () => {
    expect(coverShareImage("https://example.com/cover.jpg", true)).toBeUndefined();
    expect(coverShareImage(null)).toBeUndefined();
    expect(coverShareImage("https://example.com/cover.jpg")).toBe("https://example.com/cover.jpg");
  });
});

describe("search titles and descriptions", () => {
  test("pairs the display name with a different original name", () => {
    expect(withOriginalName("葬送的芙莉莲", "葬送のフリーレン")).toBe(
      "葬送的芙莉莲 葬送のフリーレン",
    );
    expect(withOriginalName("Frieren", "Frieren")).toBe("Frieren");
    expect(withOriginalName("Frieren", null)).toBe("Frieren");
    expect(getEntityDisplayName({ name: "フリーレン", chineseName: "芙莉莲" })).toBe(
      "芙莉莲 フリーレン",
    );
    expect(getEntityDisplayName({ name: "フリーレン", chineseName: null })).toBe("フリーレン");
  });

  test("leads subject descriptions with broadcast and score", () => {
    const subject = {
      id: 1,
      title: "葬送的芙莉莲",
      type: "动画" as const,
      originalTitle: null,
      platform: null,
      date: "2026-10-04",
      totalChapters: null,
      score: 8.9,
      rank: null,
      scoreCount: null,
      nsfw: false,
      summary: "简介。",
      tags: [],
      imageUrl: null,
      broadcast: { chapters: [{ sequence: 3, date: "2026-10-18" }], completeAfter: null },
    };

    expect(buildSubjectDescription(subject, new Date("2026-10-15T00:00:00.000Z"))).toBe(
      "第 3 话 10月18日放送，评分 8.9。简介。",
    );
    expect(
      buildSubjectDescription({ ...subject, broadcast: null, score: null, summary: null }),
    ).toBe("葬送的芙莉莲（动画），首播/发售日期 2026-10-04。");
  });

  test("leads entity descriptions with the first related subject", () => {
    const subjects = (titles: string[]) => ({
      total: titles.length,
      groups: [
        {
          relation: "主角",
          items: titles.map((title, index) => ({
            id: index + 1,
            title,
            type: "动画" as const,
            relation: "主角",
            chapters: null,
            imageUrl: null,
          })),
        },
      ],
    });
    const entity = { name: "フリーレン", type: "角色", summary: "精灵魔法使。" };

    expect(buildEntityDescription("character", entity, subjects(["葬送的芙莉莲"]))).toBe(
      "出自《葬送的芙莉莲》。精灵魔法使。",
    );
    expect(buildEntityDescription("person", entity, subjects(["A", "B"]))).toBe(
      "参与《A》等 2 部作品。精灵魔法使。",
    );
    expect(buildEntityDescription("person", { ...entity, summary: null }, subjects([]))).toBe(
      "フリーレン是 Bangumi 收录的角色，关联 0 个实体。",
    );
  });
});
