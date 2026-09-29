import { describe, expect, test } from "vitest";

import { normalizeSchedule } from "./schedule";

describe("normalizeSchedule", () => {
  test("turns a complete valid upstream response into the public schedule contract", () => {
    const upstreamSchedule = [
      {
        weekday: { id: 1 },
        items: [
          {
            id: 101,
            name: "Original title",
            name_cn: "中文标题",
            rating: { score: 8.25 },
          },
        ],
      },
      { weekday: { id: 2 }, items: [] },
      { weekday: { id: 3 }, items: [] },
      { weekday: { id: 4 }, items: [] },
      { weekday: { id: 5 }, items: [] },
      { weekday: { id: 6 }, items: [] },
      { weekday: { id: 7 }, items: [] },
    ];

    expect(normalizeSchedule(upstreamSchedule, "http://localhost:8787")).toEqual({
      days: [
        {
          weekday: 1,
          items: [
            {
              id: 101,
              title: "中文标题",
              imageUrl: null,
              score: 8.25,
            },
          ],
        },
        { weekday: 2, items: [] },
        { weekday: 3, items: [] },
        { weekday: 4, items: [] },
        { weekday: 5, items: [] },
        { weekday: 6, items: [] },
        { weekday: 7, items: [] },
      ],
    });
  });

  test("merges valid groups while discarding invalid groups and items", () => {
    const upstreamSchedule = [
      {
        weekday: { id: 1 },
        items: [
          { id: 301, name_cn: "  中文名  ", name: "Original", rating: { score: 7 } },
          { id: 0, name: "Invalid ID" },
          { id: 302, name_cn: " ", name: "Original fallback", rating: { score: 0 } },
        ],
      },
      {
        weekday: { id: 1 },
        items: [{ id: 303, rating: { score: Number.POSITIVE_INFINITY } }],
      },
      { weekday: { id: 9 }, items: [{ id: 999, name: "Invalid weekday" }] },
      { items: [{ id: 998, name: "Missing weekday" }] },
    ];

    expect(normalizeSchedule(upstreamSchedule, "http://localhost:8787")).toEqual({
      days: [
        {
          weekday: 1,
          items: [
            { id: 301, title: "中文名", imageUrl: null, score: 7 },
            { id: 302, title: "Original fallback", imageUrl: null, score: null },
            { id: 303, title: "未命名条目", imageUrl: null, score: null },
          ],
        },
        { weekday: 2, items: [] },
        { weekday: 3, items: [] },
        { weekday: 4, items: [] },
        { weekday: 5, items: [] },
        { weekday: 6, items: [] },
        { weekday: 7, items: [] },
      ],
    });
  });

  test("selects the first allowed poster size and returns a Worker proxy URL", () => {
    const upstreamSchedule = [
      {
        weekday: { id: 1 },
        items: [
          {
            id: 201,
            name: "Poster priority",
            images: {
              common: "https://lain.bgm.tv/pic/cover/c/cover.jpg",
              medium: "https://lain.bgm.tv/pic/cover/m/cover.jpg",
            },
          },
          {
            id: 202,
            name: "Invalid poster",
            images: {
              large: "https://example.com/pic/cover/l/cover.jpg",
              common: "https://lain.bgm.tv/avatar/cover.jpg",
            },
          },
        ],
      },
      { weekday: { id: 2 }, items: [] },
      { weekday: { id: 3 }, items: [] },
      { weekday: { id: 4 }, items: [] },
      { weekday: { id: 5 }, items: [] },
      { weekday: { id: 6 }, items: [] },
      { weekday: { id: 7 }, items: [] },
    ];

    const result = normalizeSchedule(upstreamSchedule, "http://localhost:8787");

    expect(result.days[0]?.items).toEqual([
      {
        id: 201,
        title: "Poster priority",
        imageUrl:
          "http://localhost:8787/images?url=https%3A%2F%2Flain.bgm.tv%2Fpic%2Fcover%2Fc%2Fcover.jpg&size=large",
        score: null,
      },
      {
        id: 202,
        title: "Invalid poster",
        imageUrl: null,
        score: null,
      },
    ]);
  });
  test("sorts each day by doing count, then rating total, keeping upstream order on ties", () => {
    const upstreamSchedule = [
      {
        weekday: { id: 1 },
        items: [
          { id: 401, name: "No stats" },
          { id: 402, name: "Low doing", collection: { doing: 92 }, rating: { total: 106 } },
          { id: 403, name: "Tie A", collection: { doing: 883 }, rating: { total: 400 } },
          { id: 404, name: "High doing", collection: { doing: 5151 }, rating: { total: 3235 } },
          { id: 405, name: "Tie B", collection: { doing: 883 }, rating: { total: 432 } },
          { id: 406, name: "No stats twin" },
        ],
      },
    ];

    const result = normalizeSchedule(upstreamSchedule, "http://localhost:8787");

    expect(result.days[0]?.items.map((item) => item.id)).toEqual([404, 405, 403, 402, 401, 406]);
  });
});
