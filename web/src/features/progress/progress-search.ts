import { PROGRESS_STAGE_VALUES } from "share";

import type { ProgressStage } from "share";

export interface ProgressSearch {
  stage: ProgressStage;
}

export const DEFAULT_PROGRESS_SEARCH: ProgressSearch = { stage: "in_progress" };

export function validateProgressSearch(search: Record<string, unknown>): ProgressSearch {
  return {
    stage:
      typeof search.stage === "string" &&
      PROGRESS_STAGE_VALUES.includes(search.stage as ProgressStage)
        ? (search.stage as ProgressStage)
        : DEFAULT_PROGRESS_SEARCH.stage,
  };
}
