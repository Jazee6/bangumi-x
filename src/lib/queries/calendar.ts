import { queryOptions } from "@tanstack/react-query";
import { getCalendar } from "@/server/functions";
import type { CalendarDay } from "@/types";

const STALE_TIME = 60 * 60 * 1000; // 1 小时

export const calendarQueryOptions = () =>
	queryOptions<CalendarDay[]>({
		queryKey: ["calendar"],
		queryFn: () => getCalendar(),
		staleTime: STALE_TIME,
	});
