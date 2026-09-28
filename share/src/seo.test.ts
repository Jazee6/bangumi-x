import { describe, expect, test } from "bun:test";
import {
  isIndexableChapter,
  isIndexableCharacter,
  isIndexableCollectionList,
  isIndexablePerson,
  isIndexableRanking,
  isIndexableSubject,
} from "./index";

describe("shared SEO publication helpers", () => {
  test("isIndexableSubject excludes NSFW, unnamed, and empty-titled subjects", () => {
    expect(isIndexableSubject({ nsfw: false, title: "星际牛仔" })).toBe(true);
    expect(isIndexableSubject({ nsfw: true, title: "星际牛仔" })).toBe(false);
    expect(isIndexableSubject({ nsfw: false, title: "未命名条目" })).toBe(false);
    expect(isIndexableSubject({ nsfw: false, title: "" })).toBe(false);
    expect(isIndexableSubject({ nsfw: false, title: "   " })).toBe(false);
    expect(isIndexableSubject({ nsfw: false, title: null })).toBe(false);
  });

  test("isIndexableChapter requires a date or summary and non-NSFW parent", () => {
    expect(
      isIndexableChapter({ title: "第一话", date: "2024-01-01", summary: null }, { nsfw: false }),
    ).toBe(true);
    expect(
      isIndexableChapter({ title: "第一话", date: null, summary: "精彩开场" }, { nsfw: false }),
    ).toBe(true);
    expect(
      isIndexableChapter({ title: "第一话", date: null, summary: null }, { nsfw: false }),
    ).toBe(false);
    expect(
      isIndexableChapter(
        { title: "第一话", date: "2024-01-01", summary: "精彩开场" },
        { nsfw: true },
      ),
    ).toBe(false);
    expect(
      isIndexableChapter(
        { title: "未命名章节", date: "2024-01-01", summary: "精彩开场" },
        { nsfw: false },
      ),
    ).toBe(false);
  });

  test("isIndexableCharacter requires summary or subject relation and non-unnamed name", () => {
    expect(
      isIndexableCharacter({ name: "斯派克", summary: "赏金猎人", hasSubjectRelation: false }),
    ).toBe(true);
    expect(isIndexableCharacter({ name: "斯派克", summary: null, hasSubjectRelation: true })).toBe(
      true,
    );
    expect(isIndexableCharacter({ name: "斯派克", summary: "", hasSubjectRelation: false })).toBe(
      false,
    );
    expect(
      isIndexableCharacter({ name: "未命名角色", summary: "赏金猎人", hasSubjectRelation: true }),
    ).toBe(false);
  });

  test("isIndexablePerson requires summary or subject relation and non-unnamed name", () => {
    expect(
      isIndexablePerson({ name: "山寺宏一", summary: "知名声优", hasSubjectRelation: false }),
    ).toBe(true);
    expect(isIndexablePerson({ name: "山寺宏一", summary: null, hasSubjectRelation: true })).toBe(
      true,
    );
    expect(isIndexablePerson({ name: "山寺宏一", summary: "", hasSubjectRelation: false })).toBe(
      false,
    );
    expect(
      isIndexablePerson({ name: "未命名人物", summary: "知名声优", hasSubjectRelation: true }),
    ).toBe(false);
  });

  test("isIndexableCollectionList requires at least 3 items and a non-empty name", () => {
    expect(isIndexableCollectionList({ total: 3, name: "年度最佳" })).toBe(true);
    expect(isIndexableCollectionList({ total: 2, name: "年度最佳" })).toBe(false);
    expect(isIndexableCollectionList({ total: 5, name: "" })).toBe(false);
    expect(isIndexableCollectionList({ total: 5, name: "未命名列表" })).toBe(false);
  });

  test("isIndexableRanking requires items, year >= 1980, and not a future season", () => {
    const now = new Date("2026-06-01T00:00:00Z"); // spring 2026
    expect(isIndexableRanking({ itemCount: 10, year: 2026, season: "spring" }, now)).toBe(true);
    expect(isIndexableRanking({ itemCount: 10, year: 2026, season: "winter" }, now)).toBe(true);
    expect(isIndexableRanking({ itemCount: 10, year: 2026, season: "summer" }, now)).toBe(false);
    expect(isIndexableRanking({ itemCount: 0, year: 2026, season: "spring" }, now)).toBe(false);
    expect(isIndexableRanking({ itemCount: 10, year: 1979, season: "winter" }, now)).toBe(false);
  });
});
