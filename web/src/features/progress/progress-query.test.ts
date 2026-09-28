import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { QueryClient } from "@tanstack/react-query";

import {
  applyOptimisticProgress,
  clearProgress,
  progressRecordsQueryOptions,
  restoreProgressCaches,
  saveProgress,
  syncProgressCaches,
} from "./progress-query";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("progress queries isolate stage and paginate with credentials", async () => {
  const request = mock(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : input);
    expect(url.pathname).toBe("/me/progress");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      stage: "completed",
      page: "2",
      pageSize: "24",
    });
    expect(init?.credentials).toBe("include");
    return Response.json({ page: 2, pageSize: 24, data: [], hasPrevious: true, hasNext: false });
  });
  globalThis.fetch = request as unknown as typeof fetch;

  const options = progressRecordsQueryOptions("completed");
  expect([...options.queryKey]).toEqual(["me", "progress", { stage: "completed" }]);
  await options.queryFn?.({ pageParam: 2 } as never);

  expect(request).toHaveBeenCalledTimes(1);
});

test("progress writes send semantic values and credentials", async () => {
  const requests: Array<{ pathname: string; init?: RequestInit }> = [];
  globalThis.fetch = mock(async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({
      pathname: new URL(input instanceof Request ? input.url : input).pathname,
      init,
    });
    return Response.json({ progress: null });
  }) as unknown as typeof fetch;

  await saveProgress(42, { stage: "completed", completedChapters: 12 });
  await clearProgress(42);

  expect(requests.map(({ pathname, init }) => [pathname, init?.method, init?.credentials])).toEqual(
    [
      ["/me/progress/42", "PUT", "include"],
      ["/me/progress/42", "DELETE", "include"],
    ],
  );
  expect(requests[0]?.init?.body).toBe(
    JSON.stringify({ stage: "completed", completedChapters: 12 }),
  );
});

function progressItem(id: number, stage: "in_progress" | "completed", completedChapters: number) {
  return {
    id,
    title: `条目 ${id}`,
    type: "动画" as const,
    imageUrl: null,
    nsfw: false,
    stage,
    completedChapters,
    totalChapters: 12,
    progressUpdatedAt: "2026-09-01T00:00:00.000Z",
    collected: true,
    broadcast: null,
  };
}

function progressList(items: ReturnType<typeof progressItem>[]) {
  return {
    pageParams: [1],
    pages: [{ page: 1, pageSize: 24, data: items, hasPrevious: false, hasNext: false }],
  };
}

test("chapter steps patch cached lists in place without refetching", async () => {
  const queryClient = new QueryClient();
  const inProgressKey = ["me", "progress", { stage: "in_progress" }];
  queryClient.setQueryData(inProgressKey, progressList([progressItem(1, "in_progress", 3)]));
  const invalidate = spyOn(queryClient, "invalidateQueries");

  const snapshot = await applyOptimisticProgress(queryClient, 1, { completedChapters: 4 });
  expect(
    queryClient.getQueryData<ReturnType<typeof progressList>>(inProgressKey)?.pages[0]?.data[0]
      ?.completedChapters,
  ).toBe(4);

  const previous = {
    stage: "in_progress" as const,
    completedChapters: 3,
    totalChapters: 12,
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
  await syncProgressCaches(queryClient, 1, previous, {
    ...previous,
    completedChapters: 4,
    updatedAt: "2026-09-02T00:00:00.000Z",
  });
  expect(invalidate).not.toHaveBeenCalled();

  restoreProgressCaches(queryClient, snapshot);
  expect(
    queryClient.getQueryData<ReturnType<typeof progressList>>(inProgressKey)?.pages[0]?.data[0]
      ?.completedChapters,
  ).toBe(3);
});

test("reaching the chapter total moves the record out of the in-progress list", async () => {
  const queryClient = new QueryClient();
  const inProgressKey = ["me", "progress", { stage: "in_progress" }];
  queryClient.setQueryData(
    inProgressKey,
    progressList([progressItem(1, "in_progress", 11), progressItem(2, "in_progress", 1)]),
  );
  const invalidate = spyOn(queryClient, "invalidateQueries");

  await syncProgressCaches(
    queryClient,
    1,
    { stage: "in_progress", completedChapters: 11, totalChapters: 12, updatedAt: "x" },
    { stage: "completed", completedChapters: 12, totalChapters: 12, updatedAt: "y" },
  );

  const ids = queryClient
    .getQueryData<ReturnType<typeof progressList>>(inProgressKey)
    ?.pages[0]?.data.map((item) => item.id);
  expect(ids).toEqual([2]);
  expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
    ["me", "personal-record-counts"],
    ["me", "progress", { stage: "in_progress" }],
    ["me", "progress", { stage: "completed" }],
  ]);
});
