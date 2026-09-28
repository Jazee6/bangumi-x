import { describe, expect, test } from "bun:test";
import { buildSitemapIndex, buildUrlSet, escapeXml, validateXmlWellFormedness } from "./xml";

describe("XML escaping and validation", () => {
  test("escapes XML special characters", () => {
    expect(escapeXml(`Tom & Jerry <"classic"> '1940'`)).toBe(
      "Tom &amp; Jerry &lt;&quot;classic&quot;&gt; &apos;1940&apos;",
    );
  });

  test("strips illegal XML control characters but preserves tabs and newlines", () => {
    expect(escapeXml("Hello\x00\x08World\t!\n\r")).toBe("HelloWorld\t!\n\r");
  });

  test("preserves legal non-BMP characters like Emoji and rare CJK ideographs", () => {
    expect(escapeXml("星际牛仔 ✨ 𠮷野家 🎉")).toBe("星际牛仔 ✨ 𠮷野家 🎉");
  });

  test("validates well-formed XML", () => {
    const valid =
      '<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>测试</title></feed>';
    expect(validateXmlWellFormedness(valid)).toEqual({ valid: true });

    const unclosed = "<feed><title>测试</feed>";
    expect(validateXmlWellFormedness(unclosed).valid).toBe(false);

    const rawAmp = "<feed><title>A & B</title></feed>";
    expect(validateXmlWellFormedness(rawAmp).valid).toBe(false);
  });

  test("builds valid sitemap index and urlset", () => {
    const sitemapIndex = buildSitemapIndex([
      { loc: "https://bgmx.jaze.top/sitemap/static.xml", lastmod: "2026-03-15T10:00:00.000Z" },
    ]);
    expect(validateXmlWellFormedness(sitemapIndex)).toEqual({ valid: true });
    expect(sitemapIndex).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');

    const urlSet = buildUrlSet([
      { loc: "https://bgmx.jaze.top/subjects/101", lastmod: "2026-03-15T10:00:00.000Z" },
    ]);
    expect(validateXmlWellFormedness(urlSet)).toEqual({ valid: true });
    expect(urlSet).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
  });
});
