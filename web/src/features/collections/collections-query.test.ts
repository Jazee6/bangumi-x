import { afterEach, expect, mock, test } from "bun:test";

import {
  collectionListsQueryOptions,
  personalRecordsQueryOptions,
  personalSubjectStateQueryOptions,
  publicCollectionListQueryOptions,
  saveCollection,
  setCollectionListVisibility,
} from "./collections-query";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("personal query keys isolate every URL-backed filter and subject", () => {
  const search = {
    list: "list-42",
    type: "anime" as const,
    keyword: "贝塔",
  };
  expect([...personalRecordsQueryOptions(search).queryKey]).toEqual([
    "me",
    "personal-records",
    search,
  ]);
  expect([...personalSubjectStateQueryOptions("42").queryKey]).toEqual(["me", "subjects", "42"]);
  expect([...collectionListsQueryOptions.queryKey]).toEqual(["me", "collection-lists"]);
});

test("personal query sends only active filters with credentials", async () => {
  const request = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    expect(url.pathname).toBe("/me/collections");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      type: "anime",
      keyword: "可信",
      page: "3",
      pageSize: "24",
    });
    expect(init?.credentials).toBe("include");
    return Response.json({
      page: 3,
      pageSize: 24,
      data: [],
      hasPrevious: true,
      hasNext: false,
    });
  });
  globalThis.fetch = request as unknown as typeof fetch;

  await personalRecordsQueryOptions({
    type: "anime",
    keyword: "可信",
  }).queryFn?.({ pageParam: 3 } as never);

  expect(request).toHaveBeenCalledTimes(1);
});

test("public list queries are anonymous and isolated by share identifier", async () => {
  const request = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    expect(url.pathname).toBe("/public/collection-lists/share-42");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      page: "2",
      pageSize: "24",
    });
    expect(init?.credentials).toBeUndefined();
    return Response.json({
      name: "公开清单",
      ownerName: "Alice",
      page: 2,
      pageSize: 24,
      data: [],
      hasPrevious: true,
      hasNext: false,
    });
  });
  globalThis.fetch = request as unknown as typeof fetch;

  const options = publicCollectionListQueryOptions("share-42");
  expect([...options.queryKey]).toEqual(["public", "collection-list", "share-42"]);
  expect(options.initialPageParam).toBe(1);
  await options.queryFn?.({ pageParam: 2 } as never);
  expect(request).toHaveBeenCalledTimes(1);
});

test("collection writes include credentials and stable semantic data", async () => {
  const requests: Array<{ pathname: string; init?: RequestInit }> = [];
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      pathname: new URL(input instanceof Request ? input.url : input).pathname,
      init,
    });
    return Response.json({ ok: true });
  }) as unknown as typeof fetch;

  await saveCollection("42", ["first", "second"]);
  await setCollectionListVisibility("list-42", true);

  expect(requests.map(({ pathname, init }) => [pathname, init?.method, init?.credentials])).toEqual(
    [
      ["/me/collections/42", "PUT", "include"],
      ["/me/collection-lists/list-42/visibility", "PUT", "include"],
    ],
  );
  expect(requests[0]?.init?.body).toBe(JSON.stringify({ listIds: ["first", "second"] }));
  expect(requests[1]?.init?.body).toBe(JSON.stringify({ isPublic: true }));
});
