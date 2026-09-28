import { infiniteQueryOptions, queryOptions, useInfiniteQuery } from "@tanstack/react-query";

import type { ChapterDetail, ChapterPage } from "share";

import { requestJson } from "@/lib/api-error";
import { serverUrl } from "@/lib/server-url";

export const CHAPTER_PAGE_SIZE = 50;
const CHAPTER_STALE_TIME = 60 * 60 * 1000;

function getChapterPage(subjectId: string, offset: number): Promise<ChapterPage> {
  const url = new URL(`/subjects/${encodeURIComponent(subjectId)}/chapters`, serverUrl);
  url.searchParams.set("limit", CHAPTER_PAGE_SIZE.toString());
  url.searchParams.set("offset", offset.toString());
  return requestJson(url, "章节暂时无法加载，请稍后重试。");
}

export function chapterListQueryOptions(subjectId: string, page = 1) {
  const initialOffset = (page - 1) * CHAPTER_PAGE_SIZE;
  return infiniteQueryOptions({
    queryKey: ["subjects", subjectId, "chapters", ...(page > 1 ? [{ page }] : [])],
    queryFn: ({ pageParam }) => getChapterPage(subjectId, pageParam),
    initialPageParam: initialOffset,
    getNextPageParam: (lastPage) => {
      const nextOffset = lastPage.offset + lastPage.limit;
      return nextOffset < lastPage.total ? nextOffset : undefined;
    },
    staleTime: CHAPTER_STALE_TIME,
  });
}

export function useChapterListQuery(subjectId: string) {
  return useInfiniteQuery(chapterListQueryOptions(subjectId));
}

export type ChapterListQuery = ReturnType<typeof useChapterListQuery>;

function getChapter(chapterId: string): Promise<ChapterDetail> {
  return requestJson(
    new URL(`/chapters/${encodeURIComponent(chapterId)}`, serverUrl),
    "章节暂时无法加载，请稍后重试。",
  );
}

export function chapterQueryOptions(chapterId: string) {
  return queryOptions({
    queryKey: ["chapters", chapterId],
    queryFn: () => getChapter(chapterId),
    staleTime: CHAPTER_STALE_TIME,
  });
}
