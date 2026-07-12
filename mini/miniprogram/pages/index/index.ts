import { getCalendar } from "../../utils/api";
import { applyTheme, getCurrentDark } from "../../utils/page";
import { applyLayout } from "../../utils/layout";
import { buildBrandShare } from "../../utils/share";
import type { CalendarDay, LegacySubject } from "../../types";

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 7];
const WEEK_LABELS: Record<number, string> = { 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六", 7: "周日" };

function getTodayId(): number {
  const now = new Date();
  const day = now.getDay();
  return day === 0 ? 7 : day;
}

interface DayData {
  weekday: { id: number; cn: string };
  items: LegacySubject[];
  label: string;
}

Page({
  data: {
    dark: getCurrentDark(),
    expanded: false,
    loading: true,
    error: false,
    refreshing: false,
    calendar: [] as DayData[],
    activeId: getTodayId(),
    todayId: getTodayId(),
    currentItems: [] as (LegacySubject & { score: number })[],
  },
  onLoad() {
    wx.setNavigationBarTitle({ title: "每日放送｜Bangumi X" });
    this.loadData();
  },
  onShow() {
    applyTheme.call(this);
    applyLayout.call(this);
  },
  onThemeChange() {
    applyTheme.call(this);
  },
  onResize() {
    applyLayout.call(this);
  },
  onRefresh() {
    this.setData({ refreshing: true });
    this.loadData().finally(() => this.setData({ refreshing: false }));
  },
  async loadData() {
    this.setData({ loading: true, error: false });
    try {
      const cal = await getCalendar();
      const sorted: DayData[] = WEEK_ORDER.map((id) => {
        const day = cal.find((d: CalendarDay) => d.weekday.id === id);
        const cn = day?.weekday.cn ?? WEEK_LABELS[id] ?? "—";
        return day
          ? { weekday: day.weekday, items: day.items, label: cn }
          : { weekday: { id, cn }, items: [], label: cn };
      });
      this.setData({ calendar: sorted, loading: false });
      this.applyActive();
    } catch {
      this.setData({ loading: false, error: true });
    }
  },
  onPickDay(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    const day = this.data.calendar.find((item) => item.weekday.id === id);
    if (!day) return;
    this.setData({
      activeId: day.weekday.id,
    });
    this.applyActive();
  },
  applyActive() {
    const { calendar, activeId } = this.data;
    const day = calendar.find((d) => d.weekday.id === activeId);
    const items = (day?.items ?? []).map((it) => ({
      ...it,
      score: it.rating?.score ?? 0,
    }));
    this.setData({ currentItems: items });
  },
  onRetry() {
    this.loadData();
  },
  onShareAppMessage() {
    return buildBrandShare("index");
  },
  onShareTimeline() {
    return buildBrandShare("index");
  },
});
