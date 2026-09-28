import { WEEKDAY_LABELS, type IsoWeekday, type ScheduleResponse } from "share";

import {} from "../../lib/detail-pages";
import { publicPageCache } from "../../lib/memory-cache";
import { scheduleShare } from "../../lib/public-sharing";
import { getLocalIsoWeekday, SCHEDULE_STALE_TIME, WEEKDAY_OPTIONS } from "../../lib/public-pages";
import { getErrorMessage, requestJson } from "../../lib/request";
import { toPosterViewModel, type PosterViewModel } from "../../lib/view-models";

const SCHEDULE_CACHE_KEY = "schedule";
const SCHEDULE_TABS_HEIGHT = 55;
const POSTER_SKELETONS = Array.from({ length: 8 }, (_, index) => index);
let requestVersion = 0;

function selectItems(schedule: ScheduleResponse, weekday: IsoWeekday): PosterViewModel[] {
  return (schedule.days.find((day) => day.weekday === weekday)?.items ?? []).map(toPosterViewModel);
}

Page({
  // 完整一周的编排只在逻辑层保留，渲染层只接收当天的条目。
  schedule: null as ScheduleResponse | null,
  data: {
    contentInsetTop: SCHEDULE_TABS_HEIGHT,
    errorMessage: "",
    items: [] as PosterViewModel[],
    loaded: false,
    loading: true,
    posterSkeletons: POSTER_SKELETONS,
    selectedWeekday: getLocalIsoWeekday(),
    weekdays: WEEKDAY_OPTIONS,
  },

  onLoad(options: Record<string, string | undefined>) {
    const weekday = Number(options.weekday);
    if (weekday >= 1 && weekday <= 7 && Number.isInteger(weekday)) {
      this.setData({ selectedWeekday: weekday as IsoWeekday });
    }
    wx.setNavigationBarTitle({ title: `${WEEKDAY_LABELS[this.data.selectedWeekday]}放送` });
    void this.loadSchedule();
  },

  onShareAppMessage() {
    return scheduleShare(this.data.selectedWeekday).friend;
  },

  onShareTimeline() {
    return scheduleShare(this.data.selectedWeekday).timeline;
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    const headerHeight = event.detail.height;
    this.setData({ contentInsetTop: headerHeight + SCHEDULE_TABS_HEIGHT });
  },

  onSelectWeekday(event: WechatMiniprogram.CustomEvent<{ value: IsoWeekday }>) {
    const weekday = event.detail.value;
    const schedule = this.schedule as ScheduleResponse | null;
    this.setData({
      items: schedule ? selectItems(schedule, weekday) : [],
      selectedWeekday: weekday,
    });
    wx.setNavigationBarTitle({ title: `${WEEKDAY_LABELS[weekday]}放送` });
  },

  onRetry() {
    void this.loadSchedule();
  },

  async loadSchedule() {
    const version = ++requestVersion;
    this.setData({
      errorMessage: "",
      loading: !this.data.loaded,
    });

    try {
      const schedule = await publicPageCache.load(SCHEDULE_CACHE_KEY, SCHEDULE_STALE_TIME, () =>
        requestJson<ScheduleResponse>("/schedule"),
      );
      if (version !== requestVersion) return;
      this.schedule = schedule;
      this.setData({
        items: selectItems(schedule, this.data.selectedWeekday),
        loaded: true,
        loading: false,
      });
    } catch (error) {
      if (version !== requestVersion) return;
      const errorMessage = getErrorMessage(error);
      this.setData({
        errorMessage: this.data.loaded ? "" : errorMessage,
        loading: false,
      });
      if (this.data.loaded) wx.showToast({ title: errorMessage, icon: "none" });
    }
  },
});
