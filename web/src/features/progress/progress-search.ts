import { PROGRESS_STAGE_VALUES, SEARCH_KEYWORD_MAX_LENGTH } from "share";

import type { ProgressStage } from "share";

export interface ProgressSearch {
  stage: ProgressStage;
  keyword?: string;
}

export const DEFAULT_PROGRESS_SEARCH: ProgressSearch = { stage: "in_progress" };

export function validateProgressSearch(search: Record<string, unknown>): ProgressSearch {
  const keyword = typeof search.keyword === "string" ? search.keyword.trim() : undefined;
  return {
    stage:
      typeof search.stage === "string" &&
      PROGRESS_STAGE_VALUES.includes(search.stage as ProgressStage)
        ? (search.stage as ProgressStage)
        : DEFAULT_PROGRESS_SEARCH.stage,
    ...(keyword && keyword.length <= SEARCH_KEYWORD_MAX_LENGTH ? { keyword } : {}),
  };
}
