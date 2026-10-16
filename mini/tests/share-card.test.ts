import { describe, expect, test } from "bun:test";

import { withShareCard, wrapText } from "../miniprogram/lib/share-card";

// Every character is one unit wide.
const measure = (value: string) => Array.from(value).length;

describe("share card", () => {
  test("wraps text by character and keeps short text on one line", () => {
    expect(wrapText("葬送的芙莉莲", 10, 2, measure)).toEqual(["葬送的芙莉莲"]);
    expect(wrapText("一二三四五六七", 3, 3, measure)).toEqual(["一二三", "四五六", "七"]);
  });

  test("ends the last allowed line with an ellipsis when text overflows", () => {
    expect(wrapText("一二三四五六七", 3, 2, measure)).toEqual(["一二三", "四五…"]);
  });

  test("drops the space at a line break without marking the text truncated", () => {
    expect(wrapText("abc def", 3, 2, measure)).toEqual(["abc", "def"]);
  });

  test("keeps the default share when there is no cover to compose", () => {
    const share = { title: "条目 · 番迹", path: "/pages/subjects/detail/index?id=1", imageUrl: "" };
    expect(withShareCard(share, { title: "条目", imageUrl: "", lines: [] })).toBe(share);
  });
});
