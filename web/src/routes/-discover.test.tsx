import { expect, test } from "bun:test";

import { Route } from "./_app/discover/$type";

type SearchMiddleware = (context: {
  search: Record<string, unknown>;
  next: (search: Record<string, unknown>) => Record<string, unknown>;
}) => Record<string, unknown>;

const routeOptions = Route.options as typeof Route.options & {
  validateSearch: (search: Record<string, unknown>) => Record<string, unknown>;
  search: { middlewares: SearchMiddleware[] };
};

test("the canonical discover route validates type search state and pagination", () => {
  expect(routeOptions.validateSearch({ keyword: "  高达 ", page: "3" })).toEqual({
    tab: "subjects",
    keyword: "高达",
    page: 3,
  });
  expect(routeOptions.validateSearch({ keyword: "", page: "nope" })).toEqual({
    tab: "subjects",
    page: 1,
  });
});

test("the discover route strips the default page parameter", () => {
  const middleware = routeOptions.search.middlewares[0];
  if (!middleware) throw new Error("Discover search middleware was not registered");
  const apply = (search: Record<string, unknown>) =>
    middleware({ search, next: (nextSearch) => nextSearch });

  expect(apply({ page: 1 })).toEqual({});
  expect(apply({ page: 2, keyword: "高达" })).toEqual({ page: 2, keyword: "高达" });
});
