import { queryOptions, useQuery } from "@tanstack/react-query";

import type { SubjectCharactersResponse } from "share";

import { ENTITY_STALE_TIME, getEntityJson } from "@/features/entities/entity-query";

export function subjectCharactersQueryOptions(subjectId: string) {
  return queryOptions({
    queryKey: ["subjects", subjectId, "characters"],
    queryFn: () =>
      getEntityJson<SubjectCharactersResponse>(
        `/subjects/${encodeURIComponent(subjectId)}/characters`,
        "角色暂时无法加载，请稍后重试。",
      ),
    staleTime: ENTITY_STALE_TIME,
  });
}

export function useSubjectCharactersQuery(subjectId: string) {
  return useQuery(subjectCharactersQueryOptions(subjectId));
}
