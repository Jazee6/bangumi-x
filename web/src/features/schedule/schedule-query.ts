import { queryOptions } from "@tanstack/react-query";

import type { ScheduleResponse } from "share";

import { requestJson } from "@/lib/api-error";
import { serverUrl } from "@/lib/server-url";

const SCHEDULE_STALE_TIME = 60 * 60 * 1000;

function getSchedule(): Promise<ScheduleResponse> {
  return requestJson(new URL("/schedule", serverUrl), "每日放送暂时无法加载，请稍后重试。");
}

export const scheduleQueryOptions = queryOptions({
  queryKey: ["schedule"],
  queryFn: getSchedule,
  staleTime: SCHEDULE_STALE_TIME,
});
