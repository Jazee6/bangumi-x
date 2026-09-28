import { expect, test } from "bun:test";

import { DEFAULT_PROGRESS_SEARCH, validateProgressSearch } from "./progress-search";

test("progress search defaults to in-progress", () => {
  expect(validateProgressSearch({})).toEqual(DEFAULT_PROGRESS_SEARCH);
  expect(validateProgressSearch({ stage: "planned" })).toEqual(DEFAULT_PROGRESS_SEARCH);
});

test("progress search preserves the completed stage", () => {
  expect(validateProgressSearch({ stage: "completed" })).toEqual({ stage: "completed" });
});
