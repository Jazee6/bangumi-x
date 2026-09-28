import { expect, test } from "bun:test";

import {
  DEFAULT_COLLECTIONS_SEARCH,
  updateCollectionsSearch,
  validateCollectionsSearch,
} from "./collections-search";

test("personal collection search falls back to safe defaults", () => {
  expect(validateCollectionsSearch({ page: "0", type: "movie" })).toEqual(
    DEFAULT_COLLECTIONS_SEARCH,
  );
});

test("personal collection search restores normalized filters and ignores pagination", () => {
  expect(
    validateCollectionsSearch({
      list: "list-42",
      type: "anime",
      keyword: "  贝塔  ",
      page: "3",
    }),
  ).toEqual({
    list: "list-42",
    type: "anime",
    keyword: "贝塔",
  });
});

test("filter transitions preserve active filters", () => {
  const current = {
    list: "list-42",
    type: "anime" as const,
    keyword: "贝塔",
  };
  expect(updateCollectionsSearch(current, { keyword: "阿尔法" })).toEqual({
    ...current,
    keyword: "阿尔法",
  });
});

test("drops invalid optional values", () => {
  expect(
    validateCollectionsSearch({
      type: "other",
      keyword: "   ",
      page: 2.5,
    }),
  ).toEqual({});
});
