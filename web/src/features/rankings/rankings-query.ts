import { infiniteQueryOptions } from "@tanstack/react-query";

import { RANKINGS_PAGE_SIZE, type RankingsPage, type Season } from "share";

import { requestJson } from "@/lib/api-error";
import { serverUrl } from "@/lib/server-url";

const RANKINGS_STALE_TIME = 60 * 60 * 1000;

function getRankings(year: number, season: Season, page: number): Promise<RankingsPage> {
  const url = new URL("/rankings", serverUrl);
  url.searchParams.set("year", year.toString());
  url.searchParams.set("season", season);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("pageSize", RANKINGS_PAGE_SIZE.toString());
  return requestJson(url, "排行榜暂时无法加载，请稍后重试。");
}

export function rankingsQueryOptions(year: number, season: Season, initialPage = 1) {
  return infiniteQueryOptions({
    queryKey: [
      "rankings",
      {
        year,
        season,
        pageSize: RANKINGS_PAGE_SIZE,
        ...(initialPage > 1 ? { initialPage } : {}),
      },
    ],
    queryFn: ({ pageParam }) => getRankings(year, season, pageParam),
    initialPageParam: initialPage,
    getNextPageParam: (lastPage) => (lastPage.hasNext ? lastPage.page + 1 : undefined),
    staleTime: RANKINGS_STALE_TIME,
  });
}
