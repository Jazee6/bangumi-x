import { getCalendar } from "../../utils/api";
import { applyTheme, getCurrentDark, navigateToDetail } from "../../utils/page";
import { buildBrandShare } from "../../utils/share";
import { ICON_CHEVRON_DOWN_LIGHT, ICON_CHEVRON_DOWN_DARK } from "../../utils/icons";
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
    loading: true,
    error: false,
    refreshing: false,
    calendar: [] as DayData[],
    activeId: getTodayId(),
    activeIndex: 0,
    currentDayLabel: WEEK_LABELS[getTodayId()] ?? "今日",
    chevronDown: ICON_CHEVRON_DOWN_LIGHT,
    currentItems: [] as (LegacySubject & { score: number })[],
  },
  onLoad() {
    this.loadData();
  },
  onShow() {
    applyTheme.call(this);
    this.setData({ chevronDown: getCurrentDark() ? ICON_CHEVRON_DOWN_DARK : ICON_CHEVRON_DOWN_LIGHT });
  },
  onThemeChange() {
    applyTheme.call(this);
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
      const activeIndex = Math.max(0, sorted.findIndex((d) => d.weekday.id === this.data.activeId));
      this.setData({ calendar: sorted, activeIndex, loading: false });
      this.applyActive();
    } catch {
      this.setData({ loading: false, error: true });
    }
  },
  onPickDay(e: { detail: { value: number } }) {
    const index = e.detail.value;
    const day = this.data.calendar[index];
    if (!day) return;
    this.setData({
      activeId: day.weekday.id,
      activeIndex: index,
      currentDayLabel: day.label,
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
  onTapSubject(e: WechatMiniprogram.TouchEvent) {
    const id = Number(e.currentTarget.dataset.id);
    navigateToDetail("subject", id);
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
