import { expect, test } from "bun:test";

import { rankingsQueryOptions } from "./rankings-query";

test("ranking query keys include filters but not the loaded page", () => {
  expect([...rankingsQueryOptions(2025, "spring").queryKey]).toEqual([
    "rankings",
    { year: 2025, season: "spring", pageSize: 24 },
  ]);
  expect(rankingsQueryOptions(2025, "spring").queryKey).not.toEqual(
    rankingsQueryOptions(2025, "summer").queryKey,
  );
});

test("ranking queries advance until the final page", () => {
  const options = rankingsQueryOptions(2025, "spring");
  expect(options.initialPageParam).toBe(1);
  expect(options.getNextPageParam?.({ page: 1, hasNext: true } as never, [], 1, [])).toBe(2);
  expect(
    options.getNextPageParam?.({ page: 2, hasNext: false } as never, [], 2, []),
  ).toBeUndefined();
});
