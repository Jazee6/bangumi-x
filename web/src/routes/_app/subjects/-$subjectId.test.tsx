import { expect, test } from "bun:test";

import { Route as SubjectIndexRoute } from "./$subjectId/index";

type SearchMiddleware = (context: {
  search: Record<string, unknown>;
  next: (search: Record<string, unknown>) => Record<string, unknown>;
}) => Record<string, unknown>;

const subjectIndexOptions = SubjectIndexRoute.options as typeof SubjectIndexRoute.options & {
  validateSearch: (search: Record<string, unknown>) => Record<string, unknown>;
  search: { middlewares: SearchMiddleware[] };
};

test("the subject index route validates chapter pagination search", () => {
  expect(subjectIndexOptions.validateSearch({ page: "3" })).toEqual({ page: 3 });
  expect(subjectIndexOptions.validateSearch({ page: 0 })).toEqual({ page: 1 });
  expect(subjectIndexOptions.validateSearch({})).toEqual({ page: 1 });
});

test("the subject index route strips default page parameter", () => {
  const middleware = subjectIndexOptions.search.middlewares[0];
  if (!middleware) throw new Error("Chapters search middleware was not registered");
  const apply = (search: Record<string, unknown>) =>
    middleware({ search, next: (nextSearch) => nextSearch });

  expect(apply({ page: 1 })).toEqual({});
  expect(apply({ page: 2 })).toEqual({ page: 2 });
});
