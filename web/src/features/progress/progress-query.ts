import { infiniteQueryOptions, type InfiniteData, type QueryClient } from "@tanstack/react-query";

import { COLLECTION_PAGE_SIZE } from "share";
import type {
  CollectionPage,
  PersonalSubjectState,
  ProgressItem,
  ProgressPage,
  ProgressStage,
  SubjectProgress,
} from "share";

import { requestJson } from "@/lib/api-error";
import { serverUrl } from "@/lib/server-url";

const PRIVATE_STALE_TIME = 60 * 1000;

export interface ProgressUpdate {
  stage?: ProgressStage;
  completedChapters?: number;
}

function progressJson<T>(url: URL, init?: RequestInit): Promise<T> {
  return requestJson<T>(url, "进度暂时无法更新，请稍后重试。", { ...init, credentials: "include" });
}

export function progressRecordsQueryOptions(stage: ProgressStage) {
  return infiniteQueryOptions({
    queryKey: ["me", "progress", { stage }],
    queryFn: ({ pageParam }) => {
      const url = new URL("/me/progress", serverUrl);
      url.searchParams.set("stage", stage);
      url.searchParams.set("page", pageParam.toString());
      url.searchParams.set("pageSize", COLLECTION_PAGE_SIZE.toString());
      return progressJson<ProgressPage>(url);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    staleTime: PRIVATE_STALE_TIME,
  });
}

export function saveProgress(subjectId: number, update: ProgressUpdate) {
  return progressJson<{ progress: SubjectProgress }>(
    new URL(`/me/progress/${encodeURIComponent(subjectId)}`, serverUrl),
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    },
  );
}

export function clearProgress(subjectId: number) {
  return progressJson<{ progress: null }>(
    new URL(`/me/progress/${encodeURIComponent(subjectId)}`, serverUrl),
    { method: "DELETE" },
  );
}

const PROGRESS_LISTS_KEY = ["me", "progress"] as const;
const PERSONAL_RECORDS_KEY = ["me", "personal-records"] as const;
const COUNTS_KEY = ["me", "personal-record-counts"] as const;

function subjectStateKey(subjectId: number) {
  return ["me", "subjects", subjectId.toString()] as const;
}

function patchProgressItem(item: ProgressItem, progress: Partial<SubjectProgress>): ProgressItem {
  return {
    ...item,
    ...(progress.stage === undefined ? {} : { stage: progress.stage }),
    ...(progress.completedChapters === undefined
      ? {}
      : { completedChapters: progress.completedChapters }),
    ...(progress.totalChapters === undefined ? {} : { totalChapters: progress.totalChapters }),
    ...(progress.updatedAt === undefined ? {} : { progressUpdatedAt: progress.updatedAt }),
  };
}

function mapProgressLists(
  queryClient: QueryClient,
  subjectId: number,
  update: (item: ProgressItem, stage: ProgressStage) => ProgressItem | null,
) {
  for (const [queryKey, data] of queryClient.getQueriesData<InfiniteData<ProgressPage>>({
    queryKey: PROGRESS_LISTS_KEY,
  })) {
    if (!data) continue;
    const { stage } = queryKey[2] as { stage: ProgressStage };
    queryClient.setQueryData<InfiniteData<ProgressPage>>(queryKey, {
      ...data,
      pages: data.pages.map((page) => ({
        ...page,
        data: page.data.flatMap((item) => {
          if (item.id !== subjectId) return [item];
          const next = update(item, stage);
          return next ? [next] : [];
        }),
      })),
    });
  }
}

export interface ProgressCacheSnapshot {
  entries: Array<[readonly unknown[], unknown]>;
}

// 乐观写入只更新已缓存的数值，不预测阶段迁移；阶段以服务端返回的记录为准。
export async function applyOptimisticProgress(
  queryClient: QueryClient,
  subjectId: number,
  update: ProgressUpdate,
): Promise<ProgressCacheSnapshot> {
  const keys: ReadonlyArray<readonly unknown[]> = [PROGRESS_LISTS_KEY, subjectStateKey(subjectId)];
  await Promise.all(keys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
  const entries = keys.flatMap((queryKey) => queryClient.getQueriesData({ queryKey }));
  mapProgressLists(queryClient, subjectId, (item) => patchProgressItem(item, update));
  queryClient.setQueryData<PersonalSubjectState>(subjectStateKey(subjectId), (state) =>
    state?.progress ? { ...state, progress: { ...state.progress, ...update } } : state,
  );
  return { entries };
}

export function restoreProgressCaches(queryClient: QueryClient, snapshot: ProgressCacheSnapshot) {
  for (const [queryKey, data] of snapshot.entries) queryClient.setQueryData(queryKey, data);
}

// 按服务端返回的记录同步所有缓存。只有记录新建、清除或进度阶段变化时才让列表和计数重新加载；
// 旧阶段列表也要重新加载，否则本地移除会让服务端分页边界错位，加载下一页时漏掉一条。
export async function syncProgressCaches(
  queryClient: QueryClient,
  subjectId: number,
  previous: SubjectProgress | null,
  progress: SubjectProgress | null,
) {
  mapProgressLists(queryClient, subjectId, (item, stage) =>
    progress?.stage === stage ? patchProgressItem(item, progress) : null,
  );
  queryClient.setQueryData<PersonalSubjectState>(subjectStateKey(subjectId), (state) =>
    state ? { ...state, progress } : state,
  );
  queryClient.setQueriesData<InfiniteData<CollectionPage>>(
    { queryKey: PERSONAL_RECORDS_KEY },
    (data) =>
      data && {
        ...data,
        pages: data.pages.map((page) => ({
          ...page,
          data: page.data.map((item) => (item.id === subjectId ? { ...item, progress } : item)),
        })),
      },
  );

  if (previous?.stage === progress?.stage) return;
  const stages = [previous?.stage, progress?.stage].filter(
    (stage): stage is ProgressStage => stage !== undefined,
  );
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: COUNTS_KEY }),
    ...stages.map((stage) =>
      queryClient.invalidateQueries({ queryKey: [...PROGRESS_LISTS_KEY, { stage }] }),
    ),
  ]);
}
