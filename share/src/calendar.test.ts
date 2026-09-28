import { expect, test } from "bun:test";

import { getCurrentSeason, getCurrentYear, isFutureSeason } from "./index";

test("current year and season follow China Standard Time at boundaries", () => {
  const newYearInChina = new Date("2026-12-31T16:00:00Z");
  expect(getCurrentYear(newYearInChina)).toBe(2027);
  expect(getCurrentSeason(newYearInChina)).toBe("winter");

  const beforeNewYearInChina = new Date("2026-12-31T15:59:59Z");
  expect(getCurrentYear(beforeNewYearInChina)).toBe(2026);
  expect(getCurrentSeason(beforeNewYearInChina)).toBe("autumn");

  const springInChina = new Date("2026-03-31T16:00:00Z");
  expect(getCurrentSeason(springInChina)).toBe("spring");
  expect(isFutureSeason(2026, "spring", springInChina)).toBe(false);
  expect(isFutureSeason(2026, "summer", springInChina)).toBe(true);
});
