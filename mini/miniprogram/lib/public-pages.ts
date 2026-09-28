import {
  DISCOVERY_PAGE_SIZE,
  getCurrentSeason,
  getCurrentYear,
  isFutureSeason,
  RANKINGS_MAX_ITEMS,
  RANKINGS_MIN_YEAR,
  RANKINGS_PAGE_SIZE,
  SEASON_LABELS,
  SEASON_VALUES,
  SUBJECT_TYPE_FILTER_LABELS,
  SUBJECT_TYPE_FILTER_VALUES,
  WEEKDAY_LABELS,
  type IsoWeekday,
  type Season,
  type SubjectTypeFilter,
} from "share";

import type { Query } from "./request";

export const SCHEDULE_STALE_TIME = 60 * 60 * 1_000;
export const POPULAR_STALE_TIME = 24 * 60 * 60 * 1_000;
export const SEARCH_STALE_TIME = 10 * 60 * 1_000;
export const RANKINGS_STALE_TIME = 60 * 60 * 1_000;
export const MAX_DISCOVERY_PAGE = 5;
export const MAX_RANKINGS_PAGE = Math.ceil(RANKINGS_MAX_ITEMS / RANKINGS_PAGE_SIZE);

export type DiscoverTab = "subjects" | "characters" | "persons";

export interface RequestDescriptor {
  path: string;
  query: Query;
}

export const WEEKDAY_OPTIONS = Object.keys(WEEKDAY_LABELS).map((key) => {
  const value = Number(key) as IsoWeekday;
  return { label: WEEKDAY_LABELS[value].replace("星期", ""), value };
});
export const SUBJECT_TYPE_OPTIONS = SUBJECT_TYPE_FILTER_VALUES.map((value) => ({
  label: SUBJECT_TYPE_FILTER_LABELS[value],
  value,
}));
export const SEASON_OPTIONS = SEASON_VALUES.map((value) => ({
  label: SEASON_LABELS[value],
  value,
}));

export function getLocalIsoWeekday(date = new Date()): IsoWeekday {
  const weekday = date.getDay();
  return (weekday === 0 ? 7 : weekday) as IsoWeekday;
}

export function getRankingYears(currentYear = getCurrentYear()): number[] {
  return Array.from(
    { length: currentYear - RANKINGS_MIN_YEAR + 1 },
    (_, index) => currentYear - index,
  );
}

export function clampRankingSeason(year: number, season: Season, now = new Date()): Season {
  return isFutureSeason(year, season, now) ? getCurrentSeason(now) : season;
}

export function getSeasonOptions(year: number, now = new Date()) {
  return SEASON_OPTIONS.map((option) => ({
    ...option,
    disabled: isFutureSeason(year, option.value, now),
  }));
}

export function getDiscoveryRequest(
  tab: DiscoverTab,
  type: SubjectTypeFilter,
  keyword: string,
  page: number,
  year = getCurrentYear(),
): RequestDescriptor | null {
  const trimmedKeyword = keyword.trim();
  if (tab !== "subjects" && !trimmedKeyword) return null;
  if (tab === "subjects" && !trimmedKeyword) {
    return {
      path: "/discover/popular",
      query: { page, pageSize: DISCOVERY_PAGE_SIZE, type, year },
    };
  }
  return {
    path: `/discover/search/${tab}`,
    query: {
      keyword: trimmedKeyword,
      page,
      pageSize: DISCOVERY_PAGE_SIZE,
      type: tab === "subjects" ? type : undefined,
    },
  };
}

export function getRankingsRequest(year: number, season: Season, page: number): RequestDescriptor {
  return {
    path: "/rankings",
    query: { page, pageSize: RANKINGS_PAGE_SIZE, season, year },
  };
}

export type FooterState = "error" | "hidden" | "loading";

export function getFooterState(
  itemCount: number,
  loaded: boolean,
  loadingMore: boolean,
  loadMoreError: boolean,
): FooterState {
  if (!loaded || itemCount === 0) return "hidden";
  if (loadingMore) return "loading";
  if (loadMoreError) return "error";
  return "hidden";
}

// 首页整体替换数组；追加分页时只把新增项按数据路径交给渲染层，避免每页重复传输整个数组。
export function pagePatch<T extends { id: number }>(
  key: string,
  current: T[],
  incoming: T[],
  append: boolean,
): { length: number; patch: Record<string, T | T[]> } {
  const base = append ? current : [];
  const seen = new Set(base.map((item) => item.id));
  const fresh = incoming.filter((item) => !seen.has(item.id) && seen.add(item.id));
  if (!append) return { length: fresh.length, patch: { [key]: fresh } };
  const patch: Record<string, T> = {};
  fresh.forEach((item, index) => {
    patch[`${key}[${base.length + index}]`] = item;
  });
  return { length: base.length + fresh.length, patch };
}

export function formatScore(score: number | null): string {
  return score == null ? "" : score.toFixed(1);
}

export function getDiscoveryCacheKey(
  tab: DiscoverTab,
  type: SubjectTypeFilter,
  keyword: string,
  page: number,
): string {
  return `discover:${tab}:${tab === "subjects" ? type : "all"}:${keyword.trim()}:${page}`;
}

export function getRankingsCacheKey(year: number, season: Season, page: number): string {
  return `rankings:${year}:${season}:${page}`;
}
