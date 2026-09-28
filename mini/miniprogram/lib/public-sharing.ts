import {
  SEASON_LABELS,
  SUBJECT_TYPE_FILTER_LABELS,
  WEEKDAY_LABELS,
  WEEKDAY_SLUG_BY_ISO,
  type IsoWeekday,
  type Season,
  type SubjectTypeFilter,
} from "share";

import { getServerUrl } from "./config";
import type { DetailTarget } from "./detail-pages";
import type { DiscoverTab } from "./public-pages";

export type ShareFormat = "friend" | "timeline";

export function ogImage(path: string, format: ShareFormat): string {
  return `${getServerUrl()}${path}${path.includes("?") ? "&" : "?"}mini=${format}`;
}

export function detailShare(target: DetailTarget, id: number, title: string) {
  const plural = {
    subject: "subjects",
    chapter: "chapters",
    character: "characters",
    person: "persons",
  }[target];
  const path = `/pages/${plural}/detail/index?id=${id}`;
  const imagePath = `/og/${plural}/${id}`;
  return {
    friend: { title: `${title || "详情"} · 番迹`, path, imageUrl: ogImage(imagePath, "friend") },
    timeline: {
      title: `${title || "详情"} · 番迹`,
      query: `id=${id}`,
      imageUrl: ogImage(imagePath, "timeline"),
    },
  };
}

export function scheduleShare(weekday: IsoWeekday) {
  const title = `${WEEKDAY_LABELS[weekday]}放送 · 番迹`;
  const imagePath = `/og/schedule/${WEEKDAY_SLUG_BY_ISO[weekday]}`;
  return {
    friend: {
      title,
      path: `/pages/index/index?weekday=${weekday}`,
      imageUrl: ogImage(imagePath, "friend"),
    },
    timeline: { title, query: `weekday=${weekday}`, imageUrl: ogImage(imagePath, "timeline") },
  };
}

export function discoverShare(tab: DiscoverTab, type: SubjectTypeFilter, keyword: string) {
  const query = `tab=${tab}&type=${type}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`;
  const title = keyword
    ? `搜索「${keyword}」· 番迹`
    : `${SUBJECT_TYPE_FILTER_LABELS[type]}本年度热门 · 番迹`;
  const imagePath = keyword
    ? `/og/mini-search/${tab}?keyword=${encodeURIComponent(keyword)}`
    : `/og/discover/${type}`;
  return {
    friend: {
      title,
      path: `/pages/discover/index?${query}`,
      imageUrl: ogImage(imagePath, "friend"),
    },
    timeline: { title, query, imageUrl: ogImage(imagePath, "timeline") },
  };
}

export function rankingsShare(year: number, season: Season) {
  const title = `${year} 年${SEASON_LABELS[season]}排行榜 · 番迹`;
  const query = `year=${year}&season=${season}`;
  const imagePath = `/og/rankings/${year}/${season}`;
  return {
    friend: {
      title,
      path: `/pages/rankings/index?${query}`,
      imageUrl: ogImage(imagePath, "friend"),
    },
    timeline: { title, query, imageUrl: ogImage(imagePath, "timeline") },
  };
}

export function collectionShare(shareId: string, name: string, owner: string) {
  const query = `shareId=${encodeURIComponent(shareId)}`;
  const imagePath = `/og/collection-lists/${encodeURIComponent(shareId)}`;
  const title = `${name} · ${owner || "番迹"}`;
  return {
    friend: {
      title,
      path: `/pages/collections/shared/index?${query}`,
      imageUrl: ogImage(imagePath, "friend"),
    },
    timeline: { title, query, imageUrl: ogImage(imagePath, "timeline") },
  };
}
