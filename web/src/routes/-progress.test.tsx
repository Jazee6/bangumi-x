import { expect, test } from "bun:test";

import { Route } from "./_app/progress";

type SearchMiddleware = (context: {
  search: Record<string, unknown>;
  next: (search: Record<string, unknown>) => Record<string, unknown>;
}) => Record<string, unknown>;

const routeOptions = Route.options as typeof Route.options & {
  validateSearch: (search: Record<string, unknown>) => Record<string, unknown>;
  search: { middlewares: SearchMiddleware[] };
};

test("the progress route validates its stage", () => {
  expect(routeOptions.validateSearch({ stage: "completed" })).toEqual({ stage: "completed" });
  expect(routeOptions.validateSearch({ stage: "planned" })).toEqual({ stage: "in_progress" });
});

test("the progress route strips only its default stage", () => {
  const middleware = routeOptions.search.middlewares[0];
  if (!middleware) throw new Error("Progress search middleware was not registered");
  const apply = (search: Record<string, unknown>) =>
    middleware({ search, next: (nextSearch) => nextSearch });

  expect(apply({ stage: "in_progress" })).toEqual({});
  expect(apply({ stage: "completed" })).toEqual({ stage: "completed" });
});
