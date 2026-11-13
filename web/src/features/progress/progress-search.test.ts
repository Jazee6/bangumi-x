import { expect, test } from "bun:test";

import { DEFAULT_PROGRESS_SEARCH, validateProgressSearch } from "./progress-search";

test("progress search defaults to in-progress", () => {
  expect(validateProgressSearch({})).toEqual(DEFAULT_PROGRESS_SEARCH);
  expect(validateProgressSearch({ stage: "planned" })).toEqual(DEFAULT_PROGRESS_SEARCH);
});

test("progress search preserves the completed and dropped stages", () => {
  expect(validateProgressSearch({ stage: "completed" })).toEqual({ stage: "completed" });
  expect(validateProgressSearch({ stage: "dropped" })).toEqual({ stage: "dropped" });
});

test("progress search trims keywords and drops blank or oversized ones", () => {
  expect(validateProgressSearch({ stage: "dropped", keyword: "  贝塔  " })).toEqual({
    stage: "dropped",
    keyword: "贝塔",
  });
  expect(validateProgressSearch({ keyword: "   " })).toEqual(DEFAULT_PROGRESS_SEARCH);
  expect(validateProgressSearch({ keyword: "a".repeat(65) })).toEqual(DEFAULT_PROGRESS_SEARCH);
});
