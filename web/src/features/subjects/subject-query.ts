import { queryOptions } from "@tanstack/react-query";

import type { SubjectDetail } from "share";

import { requestJson } from "@/lib/api-error";
import { serverUrl } from "@/lib/server-url";

const SUBJECT_STALE_TIME = 60 * 60 * 1000;

function getSubject(subjectId: string): Promise<SubjectDetail> {
  return requestJson(
    new URL(`/subjects/${encodeURIComponent(subjectId)}`, serverUrl),
    "条目暂时无法加载，请稍后重试。",
  );
}

export function subjectQueryOptions(subjectId: string) {
  return queryOptions({
    queryKey: ["subjects", subjectId],
    queryFn: () => getSubject(subjectId),
    staleTime: SUBJECT_STALE_TIME,
  });
}
