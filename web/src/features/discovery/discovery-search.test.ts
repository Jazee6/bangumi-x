import { describe, expect, test } from "bun:test";

import { DEFAULT_DISCOVER_SEARCH, validateDiscoverSearch } from "./discovery-search";

describe("validateDiscoverSearch", () => {
  test("uses the default discover state when parameters are missing", () => {
    expect(validateDiscoverSearch({})).toEqual(DEFAULT_DISCOVER_SEARCH);
  });

  test("accepts supported tabs, keywords and pages", () => {
    expect(validateDiscoverSearch({ tab: "subjects", keyword: "  高达  ", page: 3 })).toEqual({
      tab: "subjects",
      keyword: "高达",
      page: 3,
    });
    expect(validateDiscoverSearch({ tab: "persons", keyword: "山寺", page: "2" })).toEqual({
      tab: "persons",
      keyword: "山寺",
      page: 2,
    });
  });

  test("drops invalid keywords and paginates entity tabs only while searching", () => {
    expect(validateDiscoverSearch({ keyword: " ", page: 2 })).toEqual({
      tab: "subjects",
      page: 2,
    });
    expect(validateDiscoverSearch({ keyword: "x".repeat(65) })).toEqual(DEFAULT_DISCOVER_SEARCH);
    expect(validateDiscoverSearch({ tab: "characters", page: 4 })).toEqual({
      tab: "characters",
      page: 1,
    });
  });

  test("normalizes invalid values independently", () => {
    expect(validateDiscoverSearch({ tab: "unknown", page: "0" })).toEqual(DEFAULT_DISCOVER_SEARCH);
  });
});
