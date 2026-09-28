import { describe, expect, test } from "bun:test";

const componentUrl = new URL("../miniprogram/components/ui/poster-card/", import.meta.url);

function getRule(css: string, selector: string): string {
  return css.match(new RegExp(`\\${selector}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

describe("Mini poster card", () => {
  test("centers score and rank labels inside flex badges", async () => {
    const [template, css] = await Promise.all([
      Bun.file(new URL("poster-card.wxml", componentUrl)).text(),
      Bun.file(new URL("poster-card.wxss", componentUrl)).text(),
    ]);
    const badgeRule = getRule(css, ".poster-card__badge");
    const badgeTextRule = getRule(css, ".poster-card__badge-text");

    expect(template).toContain('<view wx:if="{{scoreLabel}}"');
    expect(template).toContain('<view wx:if="{{rankLabel}}"');
    expect(template.match(/class="poster-card__badge-text"/g)).toHaveLength(2);
    expect(badgeRule).toContain("display: flex");
    expect(badgeRule).toContain("align-items: center");
    expect(badgeRule).toContain("justify-content: center");
    expect(badgeTextRule).toContain("transform: translateY(1px)");
  });
});
