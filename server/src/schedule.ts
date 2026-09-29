import type { ScheduleItem, ScheduleResponse, IsoWeekday } from "share";

import { getProxiedEntityImageUrl } from "./poster";
import { isPositiveInteger, isRecord } from "./validation";

const ISO_WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

interface RankedScheduleItem {
  item: ScheduleItem;
  doing: number;
  ratingTotal: number;
}

function getCount(value: unknown): number {
  return isPositiveInteger(value) ? value : 0;
}

// 热度：在看人数倒序，评分人数倒序兜底，全部相同时保持上游顺序
function compareHeat(left: RankedScheduleItem, right: RankedScheduleItem): number {
  return right.doing - left.doing || right.ratingTotal - left.ratingTotal;
}

function getWeekday(group: unknown): IsoWeekday | null {
  if (!isRecord(group) || !isRecord(group.weekday)) {
    return null;
  }

  const weekday = group.weekday.id;
  return typeof weekday === "number" &&
    Number.isInteger(weekday) &&
    ISO_WEEKDAYS.includes(weekday as IsoWeekday)
    ? (weekday as IsoWeekday)
    : null;
}

function normalizeItem(value: unknown, workerOrigin: string): RankedScheduleItem | null {
  if (!isRecord(value) || !isPositiveInteger(value.id)) {
    return null;
  }

  const chineseTitle = typeof value.name_cn === "string" ? value.name_cn.trim() : "";
  const originalTitle = typeof value.name === "string" ? value.name.trim() : "";
  const rating = isRecord(value.rating) ? value.rating : {};
  const score = rating.score;

  return {
    item: {
      id: value.id,
      title: chineseTitle || originalTitle || "未命名条目",
      imageUrl: getProxiedEntityImageUrl(value.images, workerOrigin, "large"),
      score: typeof score === "number" && Number.isFinite(score) && score > 0 ? score : null,
    },
    doing: getCount(isRecord(value.collection) ? value.collection.doing : undefined),
    ratingTotal: getCount(rating.total),
  };
}

export function normalizeSchedule(value: unknown, workerOrigin: string): ScheduleResponse {
  if (!Array.isArray(value)) {
    throw new TypeError("Schedule response must be an array");
  }

  const rankedItemsByDay = ISO_WEEKDAYS.map((): RankedScheduleItem[] => []);

  for (const group of value) {
    const weekday = getWeekday(group);
    if (!weekday || !isRecord(group) || !Array.isArray(group.items)) {
      continue;
    }

    const rankedItems = rankedItemsByDay[weekday - 1];
    for (const item of group.items) {
      const normalizedItem = normalizeItem(item, workerOrigin);
      if (normalizedItem) {
        rankedItems?.push(normalizedItem);
      }
    }
  }

  return {
    days: ISO_WEEKDAYS.map((weekday) => ({
      weekday,
      items: (rankedItemsByDay[weekday - 1] ?? []).toSorted(compareHeat).map(({ item }) => item),
    })),
  };
}
