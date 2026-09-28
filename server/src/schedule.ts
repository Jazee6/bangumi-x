import type { ScheduleItem, ScheduleResponse, IsoWeekday } from "share";

import { getProxiedEntityImageUrl } from "./poster";
import { isPositiveInteger, isRecord } from "./validation";

const ISO_WEEKDAYS: IsoWeekday[] = [1, 2, 3, 4, 5, 6, 7];

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

function normalizeItem(value: unknown, workerOrigin: string): ScheduleItem | null {
  if (!isRecord(value) || !isPositiveInteger(value.id)) {
    return null;
  }

  const chineseTitle = typeof value.name_cn === "string" ? value.name_cn.trim() : "";
  const originalTitle = typeof value.name === "string" ? value.name.trim() : "";
  const rating = isRecord(value.rating) ? value.rating.score : undefined;

  return {
    id: value.id,
    title: chineseTitle || originalTitle || "未命名条目",
    imageUrl: getProxiedEntityImageUrl(value.images, workerOrigin, "large"),
    score: typeof rating === "number" && Number.isFinite(rating) && rating > 0 ? rating : null,
  };
}

export function normalizeSchedule(value: unknown, workerOrigin: string): ScheduleResponse {
  if (!Array.isArray(value)) {
    throw new TypeError("Schedule response must be an array");
  }

  const days: ScheduleResponse["days"] = ISO_WEEKDAYS.map((weekday) => ({
    weekday,
    items: [],
  }));

  for (const group of value) {
    const weekday = getWeekday(group);
    if (!weekday || !isRecord(group) || !Array.isArray(group.items)) {
      continue;
    }

    const day = days[weekday - 1];
    for (const item of group.items) {
      const normalizedItem = normalizeItem(item, workerOrigin);
      if (normalizedItem) {
        day?.items.push(normalizedItem);
      }
    }
  }

  return { days };
}
