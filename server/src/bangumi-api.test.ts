import { describe, expect, test } from "vitest";

import {
  getBangumiScheduleUrl,
  getBangumiCharacterPersonsUrl,
  getBangumiCharacterSubjectsUrl,
  getBangumiCharacterUrl,
  getBangumiChapterUrl,
  getBangumiChaptersUrl,
  getBangumiPersonCharactersUrl,
  getBangumiPersonSubjectsUrl,
  getBangumiPersonUrl,
  getBangumiSubjectCharactersUrl,
  getBangumiSubjectPersonsUrl,
  getBangumiSubjectUrl,
} from "./bangumi-api";

describe("getBangumiScheduleUrl", () => {
  test("uses the official Bangumi API by default", () => {
    expect(getBangumiScheduleUrl().toString()).toBe("https://api.bgm.tv/calendar");
  });

  test("uses a configured API base URL", () => {
    expect(getBangumiScheduleUrl("https://bgmapi.anibt.net/").toString()).toBe(
      "https://bgmapi.anibt.net/calendar",
    );
  });
});

describe("getBangumiChaptersUrl", () => {
  test("includes the subject and pagination query", () => {
    expect(getBangumiChaptersUrl(42, 50, 100).toString()).toBe(
      "https://api.bgm.tv/v0/episodes?subject_id=42&limit=50&offset=100",
    );
  });
});

describe("getBangumiChapterUrl", () => {
  test("builds an chapter detail URL", () => {
    expect(getBangumiChapterUrl(99, "https://bgmapi.anibt.net/").toString()).toBe(
      "https://bgmapi.anibt.net/v0/episodes/99",
    );
  });
});

describe("getBangumiSubjectUrl", () => {
  test("builds a subject URL against the official API", () => {
    expect(getBangumiSubjectUrl(42).toString()).toBe("https://api.bgm.tv/v0/subjects/42");
  });

  test("builds a subject URL against a configured API", () => {
    expect(getBangumiSubjectUrl(42, "https://bgmapi.anibt.net/").toString()).toBe(
      "https://bgmapi.anibt.net/v0/subjects/42",
    );
  });
});

describe("entity association URLs", () => {
  test("builds person resource URLs", () => {
    expect(getBangumiSubjectPersonsUrl(42).toString()).toBe(
      "https://api.bgm.tv/v0/subjects/42/persons",
    );
    expect(getBangumiPersonUrl(9).toString()).toBe("https://api.bgm.tv/v0/persons/9");
    expect(getBangumiPersonSubjectsUrl(9).toString()).toBe(
      "https://api.bgm.tv/v0/persons/9/subjects",
    );
    expect(getBangumiPersonCharactersUrl(9).toString()).toBe(
      "https://api.bgm.tv/v0/persons/9/characters",
    );
  });

  test("builds character resource URLs", () => {
    expect(getBangumiSubjectCharactersUrl(42).toString()).toBe(
      "https://api.bgm.tv/v0/subjects/42/characters",
    );
    expect(getBangumiCharacterUrl(8).toString()).toBe("https://api.bgm.tv/v0/characters/8");
    expect(getBangumiCharacterSubjectsUrl(8).toString()).toBe(
      "https://api.bgm.tv/v0/characters/8/subjects",
    );
    expect(getBangumiCharacterPersonsUrl(8).toString()).toBe(
      "https://api.bgm.tv/v0/characters/8/persons",
    );
  });
});
