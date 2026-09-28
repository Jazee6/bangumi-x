import { describe, expect, test } from "bun:test";

import { buildPageHead } from "./seo";

describe("page social metadata", () => {
  test("omits Open Graph and Twitter metadata when the image path is explicitly null", () => {
    const head = buildPageHead({
      title: "搜索结果",
      canonicalPath: "/discover/anime?keyword=test",
      publication: { state: "noindex-follow", reason: "keyword-search" },
      imagePath: null,
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
        content: expect.stringContaining("/og/brand"),
      }),
    );
  });
});
