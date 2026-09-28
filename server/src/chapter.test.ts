import { describe, expect, test } from "vitest";

import { normalizeChapterDetail, normalizeChapterPage } from "./chapter";

describe("normalizeChapterPage", () => {
  test("preserves source order and normalizes every chapter type", () => {
    const response = normalizeChapterPage(
      {
        total: 7,
        limit: 50,
        offset: 0,
        data: [
          { id: 1, type: 0, sort: 1, name_cn: "本篇标题", name: "Main" },
          { id: 2, type: 1, sort: 1, name: "Special", airdate: "2026-01-01" },
          { id: 3, type: 2, sort: 1, name: "Opening", duration: "1m30s" },
          { id: 4, type: 3, sort: 1, name: "Ending" },
          { id: 5, type: 4, sort: 2, name: "Trailer" },
          { id: 6, type: 5, sort: 1, name: "Fan edit" },
          { id: 7, type: 6, sort: 3, name: "Extra" },
        ],
      },
      50,
      0,
    );

    expect(response).toEqual({
      total: 7,
      limit: 50,
      offset: 0,
      data: [
        { id: 1, type: "本篇", sequence: 1, title: "本篇标题", date: null, duration: null },
        {
          id: 2,
          type: "特别篇",
          sequence: 1,
          title: "Special",
          date: "2026-01-01",
          duration: null,
        },
        {
          id: 3,
          type: "OP",
          sequence: 1,
          title: "Opening",
          date: null,
          duration: "1m30s",
        },
        { id: 4, type: "ED", sequence: 1, title: "Ending", date: null, duration: null },
        { id: 5, type: "PV", sequence: 2, title: "Trailer", date: null, duration: null },
        { id: 6, type: "MAD", sequence: 1, title: "Fan edit", date: null, duration: null },
        { id: 7, type: "其他", sequence: 3, title: "Extra", date: null, duration: null },
      ],
    });
  });

  test("filters invalid identities and applies stable optional fallbacks", () => {
    expect(
      normalizeChapterPage(
        {
          total: 4,
          data: [
            { id: 0, type: 0, name: "Invalid" },
            { id: 8, type: 99, sort: Number.NaN, name_cn: " ", name: " " },
            null,
            { id: 9, type: "0", sort: 2.5, name: "Fractional sequence" },
          ],
        },
        50,
        50,
      ),
    ).toEqual({
      total: 4,
      limit: 50,
      offset: 50,
      data: [
        {
          id: 8,
          type: "其他",
          sequence: null,
          title: "未命名章节",
          date: null,
          duration: null,
        },
        {
          id: 9,
          type: "其他",
          sequence: 2.5,
          title: "Fractional sequence",
          date: null,
          duration: null,
        },
      ],
    });
  });
});

describe("normalizeChapterDetail", () => {
  test("includes its subject and optional detail fields", () => {
    expect(
      normalizeChapterDetail({
        id: 10,
        subject_id: 42,
        type: 0,
        sort: 12,
        name_cn: "最终话",
        name: "Final",
        airdate: "2026-03-31",
        duration: "24m",
        desc: "章节简介",
      }),
    ).toEqual({
      id: 10,
      subjectId: 42,
      type: "本篇",
      sequence: 12,
      title: "最终话",
      date: "2026-03-31",
      duration: "24m",
      summary: "章节简介",
    });
  });

  test("rejects invalid identities without requiring optional fields", () => {
    expect(normalizeChapterDetail({ id: 11, subject_id: 42 })).toEqual({
      id: 11,
      subjectId: 42,
      type: "其他",
      sequence: null,
      title: "未命名章节",
      date: null,
      duration: null,
      summary: null,
    });
    expect(() => normalizeChapterDetail({ id: 0, subject_id: 42 })).toThrow();
    expect(() => normalizeChapterDetail({ id: 11, subject_id: 0 })).toThrow();
  });
});
