import { SEARCH_KEYWORD_MAX_LENGTH } from "share";

import { parsePage } from "@/lib/search-params";

export type DiscoverTab = "subjects" | "characters" | "persons";

export interface DiscoverSearch {
  tab: DiscoverTab;
  keyword?: string;
  page: number;
}

export const DEFAULT_DISCOVER_SEARCH = { page: 1, tab: "subjects" } as const;

const DISCOVER_TABS = new Set<string>(["subjects", "characters", "persons"]);

// 角色和人物只有搜索结果，没有关键词时不分页。
export function validateDiscoverSearch(search: Record<string, unknown>): DiscoverSearch {
  const tab =
    typeof search.tab === "string" && DISCOVER_TABS.has(search.tab)
      ? (search.tab as DiscoverTab)
      : DEFAULT_DISCOVER_SEARCH.tab;
  const trimmed = typeof search.keyword === "string" ? search.keyword.trim() : "";
  const keyword =
    trimmed.length >= 1 && trimmed.length <= SEARCH_KEYWORD_MAX_LENGTH ? trimmed : undefined;
  const page = parsePage(search.page);
  return {
    tab,
    ...(keyword ? { keyword } : {}),
    page: tab === "subjects" || keyword ? page : 1,
  };
}
