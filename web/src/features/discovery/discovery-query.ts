import { infiniteQueryOptions } from "@tanstack/react-query";

import {
  getCurrentYear,
  DISCOVERY_PAGE_SIZE,
  type CharacterPage,
  type PersonPage,
  type SubjectPage,
  type SubjectTypeFilter,
} from "share";

import { requestJson } from "@/lib/api-error";
import { serverUrl } from "@/lib/server-url";

const POPULAR_STALE_TIME = 24 * 60 * 60 * 1000;
const SEARCH_STALE_TIME = 10 * 60 * 1000;
const MAX_DISCOVERY_PAGE = 5;

function getDiscoveryPage<T>(
  path: string,
  page: number,
  params: Record<string, string>,
): Promise<T> {
  const url = new URL(path, serverUrl);
  for (const [name, value] of Object.entries(params)) url.searchParams.set(name, value);
  url.searchParams.set("page", page.toString());
  url.searchParams.set("pageSize", DISCOVERY_PAGE_SIZE.toString());
  return requestJson<T>(url, "发现内容暂时无法加载，请稍后重试。");
}

function nextPage(lastPage: { page: number; hasNext: boolean }) {
  return lastPage.hasNext && lastPage.page < MAX_DISCOVERY_PAGE ? lastPage.page + 1 : undefined;
}

export function discoverSubjectsQueryOptions(
  type: SubjectTypeFilter,
  year = getCurrentYear(),
  keyword?: string,
  initialPage = 1,
) {
  const search = keyword !== undefined;
  return infiniteQueryOptions({
    queryKey: [
      "discover",
      "subjects",
      search ? "search" : "popular",
      search
        ? { type, keyword, pageSize: DISCOVERY_PAGE_SIZE, initialPage }
        : { type, year, pageSize: DISCOVERY_PAGE_SIZE, initialPage },
    ],
    queryFn: ({ pageParam }) =>
      getDiscoveryPage<SubjectPage>(
        search ? "/discover/search/subjects" : "/discover/popular",
        pageParam,
        {
          type,
          ...(keyword === undefined ? { year: year.toString() } : { keyword }),
        },
      ),
    initialPageParam: initialPage,
    getNextPageParam: nextPage,
    staleTime: search ? SEARCH_STALE_TIME : POPULAR_STALE_TIME,
  });
}

export function discoverCharactersQueryOptions(keyword: string, initialPage = 1) {
  return infiniteQueryOptions({
    queryKey: ["discover", "characters", { keyword, pageSize: DISCOVERY_PAGE_SIZE, initialPage }],
    queryFn: ({ pageParam }) =>
      getDiscoveryPage<CharacterPage>("/discover/search/characters", pageParam, { keyword }),
    initialPageParam: initialPage,
    getNextPageParam: nextPage,
    staleTime: SEARCH_STALE_TIME,
  });
}

export function discoverPersonsQueryOptions(keyword: string, initialPage = 1) {
  return infiniteQueryOptions({
    queryKey: ["discover", "persons", { keyword, pageSize: DISCOVERY_PAGE_SIZE, initialPage }],
    queryFn: ({ pageParam }) =>
      getDiscoveryPage<PersonPage>("/discover/search/persons", pageParam, { keyword }),
    initialPageParam: initialPage,
    getNextPageParam: nextPage,
    staleTime: SEARCH_STALE_TIME,
  });
}
