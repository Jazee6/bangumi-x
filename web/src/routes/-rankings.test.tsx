import { expect, test } from "bun:test";

import { Route } from "./_app/rankings/$year/$season";

type SearchMiddleware = (context: {
  search: Record<string, unknown>;
  next: (search: Record<string, unknown>) => Record<string, unknown>;
}) => Record<string, unknown>;

const routeOptions = Route.options as typeof Route.options & {
  validateSearch: (search: Record<string, unknown>) => Record<string, unknown>;
  search: { middlewares: SearchMiddleware[] };
};

test("the canonical rankings route validates search pagination", () => {
  expect(routeOptions.validateSearch({ page: "3" })).toEqual({ page: 3 });
  expect(routeOptions.validateSearch({ page: 0 })).toEqual({ page: 1 });
  expect(routeOptions.validateSearch({ page: "invalid" })).toEqual({ page: 1 });
});

test("the rankings route strips the default page parameter", () => {
  const middleware = routeOptions.search.middlewares[0];
  if (!middleware) throw new Error("Rankings search middleware was not registered");
  const apply = (search: Record<string, unknown>) =>
    middleware({ search, next: (nextSearch) => nextSearch });

  expect(apply({ page: 1 })).toEqual({});
  expect(apply({ page: 2 })).toEqual({ page: 2 });
});
