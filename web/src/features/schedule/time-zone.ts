import type { IsoWeekday } from "share";

const DEFAULT_TIME_ZONE = "Asia/Shanghai";
const WEEKDAYS: Record<string, IsoWeekday> = {
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
  Sun: 7,
};

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format();
    return true;
  } catch {
    return false;
  }
}

export function getIsoWeekday(timeZone: string, date = new Date()): IsoWeekday {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(date);

  return WEEKDAYS[weekday] ?? 1;
}

// 服务端渲染按默认时区；客户端导航时直接使用浏览器时区，避免一次服务端往返。
export function getInitialWeekday(): IsoWeekday {
  if (typeof window === "undefined") return getIsoWeekday(DEFAULT_TIME_ZONE);
  const browserTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return getIsoWeekday(isValidTimeZone(browserTimeZone) ? browserTimeZone : DEFAULT_TIME_ZONE);
}
