import { describe, expect, test } from "bun:test";

import { buildPageHead, coverShareImage } from "./seo";

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
