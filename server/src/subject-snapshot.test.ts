import { expect, test } from "vitest";

import { normalizeSubjectSnapshot } from "./subject-snapshot";

test("normalizes only trusted stable subject snapshot fields", () => {
  expect(
    normalizeSubjectSnapshot({
      id: 42,
      name: "Original",
      name_cn: "中文标题",
      type: 2,
      nsfw: true,
      images: { large: "http://lain.bgm.tv/pic/cover/l/example.jpg" },
      rating: { score: 9.9, rank: 1 },
      summary: "must not persist",
    }),
  ).toEqual({
    subjectId: 42,
    title: "中文标题",
    type: "动画",
    posterSourceUrl: "https://lain.bgm.tv/pic/cover/l/example.jpg",
    nsfw: true,
    totalChapters: null,
  });
});

test("normalizes total chapters and medium types", () => {
  expect(
    normalizeSubjectSnapshot({
      id: 1,
      name: "Show A",
      type: 6,
      total_chapters: 12,
    }),
  ).toMatchObject({
    type: "三次元",
    totalChapters: 12,
  });

  expect(
    normalizeSubjectSnapshot({
      id: 2,
      name: "Show B",
      type: 2,
      eps: 24,
    }),
  ).toMatchObject({
    type: "动画",
    totalChapters: 24,
  });

  expect(
    normalizeSubjectSnapshot({
      id: 3,
      name: "Show C",
      type: 2,
      total_chapters: 0,
    }),
  ).toMatchObject({
    totalChapters: null,
  });
});

test("rejects malformed identity and normalizes unknown types", () => {
  expect(() => normalizeSubjectSnapshot({ id: 0, type: 2 })).toThrow();
  expect(normalizeSubjectSnapshot({ id: 1, type: 99 })).toMatchObject({ type: "其他" });
});
