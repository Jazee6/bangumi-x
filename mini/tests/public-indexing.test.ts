import { describe, expect, test } from "bun:test";

const root = new URL("../miniprogram/", import.meta.url);

function asset(path: string) {
  return Bun.file(new URL(path, root)).text();
}

describe("Mini public indexing", () => {
  test("only public pages are allowed by the sitemap", async () => {
    const sitemap = JSON.parse(await asset("sitemap.json")) as {
      rules: Array<{ action: string; page: string }>;
    };
    expect(sitemap.rules[0]).toEqual({ action: "disallow", page: "*" });
    const allowed = sitemap.rules
      .filter((rule) => rule.action === "allow")
      .map((rule) => rule.page);
    expect(allowed).toContain("pages/collections/shared/index");
    expect(allowed).toContain("pages/subjects/detail/index");
    expect(allowed.some((page) => /^(pages|packages)\/me\//.test(page))).toBe(false);
  });

  test("public cards expose direct navigator links while personal cards retain event navigation", async () => {
    for (const name of ["poster-card", "entity-row"]) {
      const template = await asset(`components/ui/${name}/${name}.wxml`);
      expect(template).toMatch(/<navigator wx:if="\{\{publicLink && /);
      expect(template).toMatch(/url="\/pages\/[^"]*detail\/index\?id=/);
      expect(template).toContain('bindtap="onSelect"');
    }
  });
});
