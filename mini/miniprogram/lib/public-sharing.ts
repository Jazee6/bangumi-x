import {
  SEASON_LABELS,
  SUBJECT_TYPE_FILTER_LABELS,
  WEEKDAY_LABELS,
  type IsoWeekday,
  type Season,
  type SubjectTypeFilter,
} from "share";

import type { DetailTarget } from "./detail-pages";
import type { DiscoverTab } from "./public-pages";

// 分享图不在服务端渲染（免费版 Worker 的 CPU 预算不够），详情页用封面，其余用代码包内的品牌图。
export const BRAND_IMAGES = {
  friend: "/assets/share/friend.png",
  timeline: "/assets/share/timeline.png",
};

export function detailShare(target: DetailTarget, id: number, title: string, imageUrl = "") {
  const plural = {
    subject: "subjects",
    chapter: "chapters",
    character: "characters",
    person: "persons",
  }[target];
  const path = `/pages/${plural}/detail/index?id=${id}`;
  return {
    friend: {
      title: `${title || "详情"} · 番迹`,
      path,
      imageUrl: imageUrl || BRAND_IMAGES.friend,
    },
    timeline: {
      title: `${title || "详情"} · 番迹`,
      query: `id=${id}`,
      imageUrl: imageUrl || BRAND_IMAGES.timeline,
    },
  };
}

export function scheduleShare(weekday: IsoWeekday) {
  const title = `${WEEKDAY_LABELS[weekday]}放送 · 番迹`;
  return {
    friend: {
      title,
      path: `/pages/index/index?weekday=${weekday}`,
      imageUrl: BRAND_IMAGES.friend,
    },
    timeline: { title, query: `weekday=${weekday}`, imageUrl: BRAND_IMAGES.timeline },
  };
}

export function discoverShare(tab: DiscoverTab, type: SubjectTypeFilter, keyword: string) {
  const query = `tab=${tab}&type=${type}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`;
  const title = keyword
    ? `搜索「${keyword}」· 番迹`
    : `${SUBJECT_TYPE_FILTER_LABELS[type]}本年度热门 · 番迹`;
  return {
    friend: {
      title,
      path: `/pages/discover/index?${query}`,
      imageUrl: BRAND_IMAGES.friend,
    },
    timeline: { title, query, imageUrl: BRAND_IMAGES.timeline },
  };
}

export function rankingsShare(year: number, season: Season) {
  const title = `${year} 年${SEASON_LABELS[season]}排行榜 · 番迹`;
  const query = `year=${year}&season=${season}`;
  return {
    friend: {
      title,
      path: `/pages/rankings/index?${query}`,
      imageUrl: BRAND_IMAGES.friend,
    },
    timeline: { title, query, imageUrl: BRAND_IMAGES.timeline },
  };
}

export function collectionShare(shareId: string, name: string, owner: string) {
  const query = `shareId=${encodeURIComponent(shareId)}`;
  const title = `${name} · ${owner || "番迹"}`;
  return {
    friend: {
      title,
      path: `/pages/collections/shared/index?${query}`,
      imageUrl: BRAND_IMAGES.friend,
    },
    timeline: { title, query, imageUrl: BRAND_IMAGES.timeline },
  };
}
