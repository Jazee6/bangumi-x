import { expect, test } from "bun:test";

import { getRankingYears } from "./rankings-search";

test("generates descending years from the current year to 1980", () => {
  expect(getRankingYears(1982)).toEqual([1982, 1981, 1980]);
});
