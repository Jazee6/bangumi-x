import { getCurrentYear, RANKINGS_MIN_YEAR } from "share";

export function getRankingYears(currentYear = getCurrentYear()): number[] {
  return Array.from(
    { length: Math.max(0, currentYear - RANKINGS_MIN_YEAR + 1) },
    (_, index) => currentYear - index,
  );
}
