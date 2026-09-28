import {
  COLLECTION_PAGE_SIZE,
  SUBJECT_TYPE_FILTER_LABELS,
  SUBJECT_TYPE_FILTER_VALUES,
  type CollectionList,
  type CollectionPage,
  type PersonalRecordCounts,
  type PersonalSubjectState,
  type ProgressPage,
  type ProgressStage,
  type PublicCollectionListPage,
  type SubjectTypeFilter,
} from "share";

import { authenticatedRequest } from "./mini-auth";
import { requestJson, type Query } from "./request";

export const SAFE_CONTENT_QUERY = { excludeNsfw: true } as const;

// 个人记录每次写入都会递增修订号；列表页据此判断返回时是否需要刷新。
let recordsRevision = 0;

export function getPersonalRecordsRevision() {
  return recordsRevision;
}

export function markPersonalRecordsChanged() {
  recordsRevision += 1;
}

function recordWrite<T>(request: Promise<T>): Promise<T> {
  return request.then((result) => {
    markPersonalRecordsChanged();
    return result;
  });
}

export const PERSONAL_TYPE_OPTIONS: Array<{ label: string; value: "all" | SubjectTypeFilter }> = [
  { label: "全部类型", value: "all" },
  ...SUBJECT_TYPE_FILTER_VALUES.map((value) => ({
    label: SUBJECT_TYPE_FILTER_LABELS[value],
    value,
  })),
];

export function personalPageQuery(
  page: number,
  filters: {
    keyword?: string;
    list?: string;
    stage?: ProgressStage;
    type?: SubjectTypeFilter;
  } = {},
): Query {
  return {
    ...SAFE_CONTENT_QUERY,
    page,
    pageSize: COLLECTION_PAGE_SIZE,
    keyword: filters.keyword,
    list: filters.list,
    stage: filters.stage,
    type: filters.type,
  };
}

export function loadCollections(
  page: number,
  filters: { keyword?: string; list?: string; type?: SubjectTypeFilter } = {},
) {
  return authenticatedRequest<CollectionPage>("/me/collections", {
    query: personalPageQuery(page, filters),
  });
}

export function loadProgress(
  page: number,
  filters: { keyword?: string; stage?: ProgressStage; type?: SubjectTypeFilter } = {},
) {
  return authenticatedRequest<ProgressPage>("/me/progress", {
    query: personalPageQuery(page, filters),
  });
}

export function loadCollectionLists() {
  return authenticatedRequest<{ data: CollectionList[] }>("/me/collection-lists", {
    query: SAFE_CONTENT_QUERY,
  });
}

export function loadPersonalRecordCounts() {
  return authenticatedRequest<PersonalRecordCounts>("/me/personal-record-counts", {
    query: SAFE_CONTENT_QUERY,
  });
}

export function loadPersonalSubjectState(subjectId: number) {
  return authenticatedRequest<PersonalSubjectState>(`/me/subjects/${subjectId}`);
}

export function saveCollection(subjectId: number, listIds: string[]) {
  return recordWrite(
    authenticatedRequest<{ collected: true; listIds: string[] }>(`/me/collections/${subjectId}`, {
      method: "PUT",
      data: { listIds },
    }),
  );
}

export function removeCollection(subjectId: number) {
  return recordWrite(
    authenticatedRequest<{ collected: false }>(`/me/collections/${subjectId}`, {
      method: "DELETE",
    }),
  );
}

export function createCollectionList(name: string) {
  return recordWrite(
    authenticatedRequest<CollectionList>("/me/collection-lists", {
      method: "POST",
      data: { name },
    }),
  );
}

export function renameCollectionList(listId: string, name: string) {
  return recordWrite(
    authenticatedRequest<{ updated: true }>(`/me/collection-lists/${encodeURIComponent(listId)}`, {
      method: "PUT",
      data: { name },
    }),
  );
}

export function setCollectionListVisibility(listId: string, isPublic: boolean) {
  return recordWrite(
    authenticatedRequest<CollectionList>(
      `/me/collection-lists/${encodeURIComponent(listId)}/visibility`,
      { method: "PUT", data: { isPublic } },
    ),
  );
}

export function deleteCollectionList(listId: string) {
  return recordWrite(
    authenticatedRequest<{ deleted: true }>(`/me/collection-lists/${encodeURIComponent(listId)}`, {
      method: "DELETE",
    }),
  );
}

export function saveProgress(
  subjectId: number,
  update: { completedChapters?: number; stage?: ProgressStage },
) {
  return recordWrite(
    authenticatedRequest<{ progress: NonNullable<PersonalSubjectState["progress"]> }>(
      `/me/progress/${subjectId}`,
      { method: "PUT", data: update },
    ),
  );
}

export function clearProgress(subjectId: number) {
  return recordWrite(
    authenticatedRequest<{ progress: null }>(`/me/progress/${subjectId}`, {
      method: "DELETE",
    }),
  );
}

export function loadPublicCollectionList(shareId: string, page: number) {
  return requestJson<PublicCollectionListPage>(
    `/public/collection-lists/${encodeURIComponent(shareId)}`,
    { ...SAFE_CONTENT_QUERY, page, pageSize: COLLECTION_PAGE_SIZE },
  );
}
