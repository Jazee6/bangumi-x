import { expect, test } from "bun:test";

import {
  discoverCharactersQueryOptions,
  discoverPersonsQueryOptions,
  discoverSubjectsQueryOptions,
} from "./discovery-query";

test("popular subject query keys isolate the canonical starting page", () => {
  expect([...discoverSubjectsQueryOptions("anime", 2026).queryKey]).toEqual([
    "discover",
    "subjects",
    "popular",
    { type: "anime", year: 2026, pageSize: 24, initialPage: 1 },
  ]);
  expect(discoverSubjectsQueryOptions("book", 2026).queryKey).not.toEqual(
    discoverSubjectsQueryOptions("anime", 2026).queryKey,
  );
});

test("search query keys include the submitted keyword and entity", () => {
  expect([...discoverSubjectsQueryOptions("anime", 2026, "高达").queryKey]).toEqual([
    "discover",
    "subjects",
    "search",
    { type: "anime", keyword: "高达", pageSize: 24, initialPage: 1 },
  ]);
  expect([...discoverCharactersQueryOptions("高达").queryKey]).toEqual([
    "discover",
    "characters",
    { keyword: "高达", pageSize: 24, initialPage: 1 },
  ]);
  expect(discoverPersonsQueryOptions("高达").queryKey).not.toEqual(
    discoverCharactersQueryOptions("高达").queryKey,
  );
});

test("infinite discovery queries advance while the server reports another page", () => {
  const options = discoverCharactersQueryOptions("高达");
  expect(options.initialPageParam).toBe(1);
  expect(options.getNextPageParam?.({ page: 2, hasNext: true } as never, [], 2, [])).toBe(3);
  expect(
    options.getNextPageParam?.({ page: 3, hasNext: false } as never, [], 3, []),
  ).toBeUndefined();
});
