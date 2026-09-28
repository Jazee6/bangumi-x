import { describe, expect, test } from "bun:test";

import {
  getBroadcastBadge,
  getDetailPath,
  mapRelatedPersons,
  parseDetailId,
} from "../miniprogram/lib/detail-pages";

describe("detail page helpers", () => {
  test("detail paths pluralize the target, as card templates assume", () => {
    for (const target of ["chapter", "character", "person", "subject"] as const)
      expect(getDetailPath(target, 7)).toBe(`/pages/${target}s/detail/index?id=7`);
  });

  test("accepts only positive integer IDs", () => {
    expect(parseDetailId("42")).toBe(42);
    expect(parseDetailId("0")).toBeNull();
    expect(parseDetailId("1.5")).toBeNull();
    expect(parseDetailId("subject-42")).toBeNull();
    expect(parseDetailId(undefined)).toBeNull();
  });

  test("formats the next broadcast chapter for a local date", () => {
    expect(
      getBroadcastBadge(
        {
          chapters: [
            { sequence: 1, date: "2026-09-20" },
            { sequence: 2, date: "2026-09-20" },
          ],
          completeAfter: null,
        },
        "2026-09-19",
      ),
    ).toBe("明天 · 第 1–2 话");
  });

  test("keeps subject context on related person rows", () => {
    expect(
      mapRelatedPersons([
        {
          relation: "声优",
          items: [
            {
              id: 7,
              name: "测试人物",
              type: "个人",
              relation: "声优",
              imageUrl: null,
              subject: { id: 42, title: "测试条目", type: "动画" },
            },
          ],
        },
      ]),
    ).toEqual([
      {
        relation: "声优",
        items: [
          {
            description: "个人 · 测试条目",
            id: 7,
            imageUrl: "",
            key: "7-42-声优",
            name: "测试人物",
            target: "person",
          },
        ],
      },
    ]);
  });
});
