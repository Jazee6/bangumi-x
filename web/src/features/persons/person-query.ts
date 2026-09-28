import { queryOptions, useQuery } from "@tanstack/react-query";

import type { SubjectPersonsResponse } from "share";

import { ENTITY_STALE_TIME, getEntityJson } from "@/features/entities/entity-query";

export function subjectPersonsQueryOptions(subjectId: string) {
  return queryOptions({
    queryKey: ["subjects", subjectId, "persons"],
    queryFn: () =>
      getEntityJson<SubjectPersonsResponse>(
        `/subjects/${encodeURIComponent(subjectId)}/persons`,
        "人物暂时无法加载，请稍后重试。",
      ),
    staleTime: ENTITY_STALE_TIME,
  });
}

export function useSubjectPersonsQuery(subjectId: string) {
  return useQuery(subjectPersonsQueryOptions(subjectId));
}
