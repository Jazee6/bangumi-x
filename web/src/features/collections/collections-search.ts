import { SUBJECT_TYPE_FILTER_VALUES } from "share";

import type { SubjectTypeFilter } from "share";

export interface CollectionsSearch {
  list?: string;
  type?: SubjectTypeFilter;
  keyword?: string;
}

export const DEFAULT_COLLECTIONS_SEARCH: CollectionsSearch = {};

export function updateCollectionsSearch(
  current: CollectionsSearch,
  patch: Partial<CollectionsSearch>,
): CollectionsSearch {
  const next = { ...current, ...patch };
  for (const key of ["list", "type", "keyword"] as const) {
    if (next[key] === undefined) delete next[key];
  }
  return next;
}

export function validateCollectionsSearch(search: Record<string, unknown>): CollectionsSearch {
  const type =
    typeof search.type === "string" &&
    SUBJECT_TYPE_FILTER_VALUES.includes(search.type as SubjectTypeFilter)
      ? (search.type as SubjectTypeFilter)
      : undefined;
  const keyword = typeof search.keyword === "string" ? search.keyword.trim() : undefined;
  const list =
    typeof search.list === "string" &&
    search.list.length > 0 &&
    search.list.length <= 64 &&
    search.list !== "all"
      ? search.list
      : undefined;

  return {
    ...(list ? { list } : {}),
    ...(type ? { type } : {}),
    ...(keyword && keyword.length <= 64 ? { keyword } : {}),
  };
}
