import {
  getCurrentSeason,
  getCurrentYear,
  SEASON_LABELS,
  type RankingsPage,
  type Season,
} from "share";

import {} from "../../lib/detail-pages";
import { publicPageCache } from "../../lib/memory-cache";
import { rankingsShare } from "../../lib/public-sharing";
import {
  getFooterState,
  pagePatch,
  clampRankingSeason,
  getRankingYears,
  getRankingsCacheKey,
  getRankingsRequest,
  getSeasonOptions,
  MAX_RANKINGS_PAGE,
  RANKINGS_STALE_TIME,
} from "../../lib/public-pages";
import { getErrorMessage, requestJson } from "../../lib/request";
import { toPosterViewModel, type PosterViewModel } from "../../lib/view-models";

const POSTER_SKELETONS = Array.from({ length: 8 }, (_, index) => index);
const CURRENT_YEAR = getCurrentYear();
const YEARS = getRankingYears(CURRENT_YEAR);
let requestVersion = 0;

Page({
  data: {
    errorMessage: "",
    footerState: "hidden" as "error" | "hidden" | "loading",
    hasNext: false,
    headerHeight: 0,
    loadMoreError: false,
    loaded: false,
    loading: true,
    loadingMore: false,
    page: 0,
    posterSkeletons: POSTER_SKELETONS,
    posters: [] as PosterViewModel[],
    season: getCurrentSeason(),
    seasons: getSeasonOptions(CURRENT_YEAR),
    year: CURRENT_YEAR,
    yearIndex: 0,
    yearLabels: YEARS.map((year) => `${year} 年`),
  },

  onLoad(options: Record<string, string | undefined>) {
    const year = Number(options.year);
    const yearIndex = YEARS.indexOf(year);
    const requested = options.season as Season;
    if (yearIndex >= 0) {
      const seasons = getSeasonOptions(year);
      const season = seasons.some((item) => item.value === requested && !item.disabled)
        ? requested
        : clampRankingSeason(year, this.data.season);
      this.setData({ year, yearIndex, season, seasons });
    }
    wx.setNavigationBarTitle({
      title: `${this.data.year} 年${SEASON_LABELS[this.data.season]}排行榜`,
    });
    void this.loadFirstPage();
  },

  onShareAppMessage() {
    return rankingsShare(this.data.year, this.data.season).friend;
  },

  onShareTimeline() {
    return rankingsShare(this.data.year, this.data.season).timeline;
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height });
  },

  onYearChange(event: WechatMiniprogram.PickerChange) {
    const yearIndex = Number(event.detail.value);
    const year = YEARS[yearIndex];
    if (!year || year === this.data.year) return;
    const season = clampRankingSeason(year, this.data.season);
    this.setData({
      season,
      seasons: getSeasonOptions(year),
      year,
      yearIndex,
    });
    wx.setNavigationBarTitle({ title: `${year} 年${SEASON_LABELS[season]}排行榜` });
    void this.loadFirstPage();
  },

  onSeasonChange(event: WechatMiniprogram.CustomEvent<{ value: Season }>) {
    const season = event.detail.value;
    const option = this.data.seasons.find((item) => item.value === season);
    if (!option || option.disabled || season === this.data.season) return;
    this.setData({ season });
    wx.setNavigationBarTitle({ title: `${this.data.year} 年${SEASON_LABELS[season]}排行榜` });
    void this.loadFirstPage();
  },

  onRetry() {
    void this.loadFirstPage();
  },

  onScrollLower() {
    if (!this.data.hasNext || this.data.loadingMore || this.data.loadMoreError) return;
    void this.loadPage(this.data.page + 1, true);
  },

  onRetryMore() {
    if (this.data.loadingMore) return;
    void this.loadPage(this.data.page + 1, true);
  },

  async loadFirstPage() {
    await this.loadPage(1, false);
  },

  async loadPage(page: number, append: boolean) {
    const year = this.data.year;
    const season = this.data.season;
    const descriptor = getRankingsRequest(year, season, page);
    const version = ++requestVersion;
    this.setData({
      errorMessage: append ? this.data.errorMessage : "",
      footerState: append ? "loading" : "hidden",
      loadMoreError: false,
      loading: !append,
      loadingMore: append,
      ...(append ? {} : { loaded: false, posters: [] }),
    });

    try {
      const result = await publicPageCache.load(
        getRankingsCacheKey(year, season, page),
        RANKINGS_STALE_TIME,
        () => requestJson<RankingsPage>(descriptor.path, descriptor.query),
      );
      if (version !== requestVersion) return;

      const { length, patch } = pagePatch(
        "posters",
        this.data.posters,
        result.data.map(toPosterViewModel),
        append,
      );
      const hasNext = result.hasNext && page < MAX_RANKINGS_PAGE;
      this.setData({
        ...patch,
        errorMessage: "",
        footerState: getFooterState(length, true, false, false),
        hasNext,
        loaded: true,
        loading: false,
        loadingMore: false,
        page,
      });
    } catch (error) {
      if (version !== requestVersion) return;
      const errorMessage = getErrorMessage(error);
      if (append) {
        this.setData({
          footerState: getFooterState(this.data.posters.length, true, false, true),
          loadMoreError: true,
          loadingMore: false,
        });
        return;
      }
      this.setData({
        errorMessage,
        loaded: false,
        loading: false,
      });
    }
  },
});
