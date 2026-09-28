import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";

import {
  COLLECTION_PAGE_SIZE,
  type CollectionList,
  type CollectionPage,
  type PersonalRecordCounts,
  type PersonalSubjectState,
  type PublicCollectionListPage,
} from "share";

import type { CollectionsSearch } from "./collections-search";
import { requestJson } from "@/lib/api-error";
import { serverUrl } from "@/lib/server-url";

const PRIVATE_STALE_TIME = 60 * 1000;
const PUBLIC_LIST_STALE_TIME = 5 * 60 * 1000;

function privateJson<T>(url: URL, init?: RequestInit): Promise<T> {
  return requestJson<T>(url, "个人数据暂时无法加载，请稍后重试。", {
    ...init,
    credentials: "include",
  });
}

function publicJson<T>(url: URL): Promise<T> {
  return requestJson<T>(url, "公开收藏列表暂时无法加载，请稍后重试。");
}

function jsonRequest(method: string, body?: unknown): RequestInit {
  return {
    method,
    ...(body === undefined
      ? {}
      : {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
  };
}

export function personalRecordsQueryOptions(search: CollectionsSearch) {
  return infiniteQueryOptions({
    queryKey: ["me", "personal-records", search],
    queryFn: ({ pageParam }) => {
      const url = new URL("/me/collections", serverUrl);
      if (search.list) url.searchParams.set("list", search.list);
      if (search.type) url.searchParams.set("type", search.type);
      if (search.keyword) url.searchParams.set("keyword", search.keyword);
      url.searchParams.set("page", pageParam.toString());
      url.searchParams.set("pageSize", COLLECTION_PAGE_SIZE.toString());
      return privateJson<CollectionPage>(url);
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    staleTime: PRIVATE_STALE_TIME,
  });
}

export function publicCollectionListQueryOptions(shareId: string, initialPage = 1) {
  return infiniteQueryOptions({
    queryKey: ["public", "collection-list", shareId, ...(initialPage === 1 ? [] : [initialPage])],
    queryFn: ({ pageParam }) => {
      const url = new URL(`/public/collection-lists/${encodeURIComponent(shareId)}`, serverUrl);
      url.searchParams.set("page", pageParam.toString());
      url.searchParams.set("pageSize", COLLECTION_PAGE_SIZE.toString());
      return publicJson<PublicCollectionListPage>(url);
    },
    initialPageParam: initialPage,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    getPreviousPageParam: (firstPage) => (firstPage.hasPrevious ? firstPage.page - 1 : undefined),
    staleTime: PUBLIC_LIST_STALE_TIME,
  });
}

export const collectionListsQueryOptions = queryOptions({
  queryKey: ["me", "collection-lists"],
  queryFn: () =>
    privateJson<{ data: CollectionList[] }>(new URL("/me/collection-lists", serverUrl)),
  staleTime: PRIVATE_STALE_TIME,
});

export const personalRecordCountsQueryOptions = queryOptions({
  queryKey: ["me", "personal-record-counts"],
  queryFn: () =>
    privateJson<PersonalRecordCounts>(new URL("/me/personal-record-counts", serverUrl)),
  staleTime: PRIVATE_STALE_TIME,
});

export function personalSubjectStateQueryOptions(subjectId: string) {
  return queryOptions({
    queryKey: ["me", "subjects", subjectId],
    queryFn: () =>
      privateJson<PersonalSubjectState>(
        new URL(`/me/subjects/${encodeURIComponent(subjectId)}`, serverUrl),
      ),
    staleTime: PRIVATE_STALE_TIME,
  });
}

export function saveCollection(subjectId: string, listIds: string[]) {
  return privateJson<{ collected: true; listIds: string[] }>(
    new URL(`/me/collections/${encodeURIComponent(subjectId)}`, serverUrl),
    jsonRequest("PUT", { listIds }),
  );
}

export function removeCollection(subjectId: string) {
  return privateJson<{ collected: false }>(
    new URL(`/me/collections/${encodeURIComponent(subjectId)}`, serverUrl),
    jsonRequest("DELETE"),
  );
}

export function createCollectionList(name: string) {
  return privateJson<CollectionList>(
    new URL("/me/collection-lists", serverUrl),
    jsonRequest("POST", { name }),
  );
}

export function renameCollectionList(listId: string, name: string) {
  return privateJson<{ updated: true }>(
    new URL(`/me/collection-lists/${encodeURIComponent(listId)}`, serverUrl),
    jsonRequest("PATCH", { name }),
  );
}

export function setCollectionListVisibility(listId: string, isPublic: boolean) {
  return privateJson<CollectionList>(
    new URL(`/me/collection-lists/${encodeURIComponent(listId)}/visibility`, serverUrl),
    jsonRequest("PUT", { isPublic }),
  );
}

export function deleteCollectionList(listId: string) {
  return privateJson<{ deleted: true }>(
    new URL(`/me/collection-lists/${encodeURIComponent(listId)}`, serverUrl),
    jsonRequest("DELETE"),
  );
}
