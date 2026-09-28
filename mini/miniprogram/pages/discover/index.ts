import type {
  CharacterPage,
  DiscoveryCharacterSummary,
  DiscoveryPersonSummary,
  PersonPage,
  SubjectPage,
  SubjectSummary,
  SubjectTypeFilter,
} from "share";
import { SUBJECT_TYPE_FILTER_LABELS } from "share";

import {} from "../../lib/detail-pages";
import { publicPageCache } from "../../lib/memory-cache";
import { discoverShare } from "../../lib/public-sharing";
import {
  getFooterState,
  pagePatch,
  getDiscoveryCacheKey,
  getDiscoveryRequest,
  MAX_DISCOVERY_PAGE,
  POPULAR_STALE_TIME,
  SEARCH_STALE_TIME,
  SUBJECT_TYPE_OPTIONS,
  type DiscoverTab,
} from "../../lib/public-pages";
import { getErrorMessage, requestJson } from "../../lib/request";
import { checkSearchKeyword } from "../../lib/validation";
import {
  toCharacterViewModel,
  toPersonViewModel,
  toPosterViewModel,
  type EntityViewModel,
  type PosterViewModel,
} from "../../lib/view-models";

const DISCOVER_TABS: Array<{ label: string; value: DiscoverTab }> = [
  { label: "条目", value: "subjects" },
  { label: "角色", value: "characters" },
  { label: "人物", value: "persons" },
];
const POSTER_SKELETONS = Array.from({ length: 8 }, (_, index) => index);
const ENTITY_SKELETONS = Array.from({ length: 6 }, (_, index) => index);
let requestVersion = 0;

type DiscoveryResultPage = CharacterPage | PersonPage | SubjectPage;

Page({
  data: {
    emptyDescription: "",
    emptyTitle: "",
    entities: [] as EntityViewModel[],
    entitySkeletons: ENTITY_SKELETONS,
    errorMessage: "",
    footerState: "hidden" as "error" | "hidden" | "loading",
    hasNext: false,
    headerHeight: 0,
    keyword: "",
    keywordInput: "",
    loadMoreError: false,
    loaded: false,
    loading: true,
    loadingMore: false,
    page: 0,
    posterSkeletons: POSTER_SKELETONS,
    posters: [] as PosterViewModel[],
    subjectType: "anime" as SubjectTypeFilter,
    subjectTypeIndex: 0,
    subjectTypeLabels: SUBJECT_TYPE_OPTIONS.map((option) => option.label),
    subjectTypeLabel: SUBJECT_TYPE_OPTIONS[0].label,
    tab: "subjects" as DiscoverTab,
    tabs: DISCOVER_TABS,
  },

  onLoad(options: Record<string, string | undefined>) {
    const tab = DISCOVER_TABS.find((item) => item.value === options.tab)?.value ?? "subjects";
    const subjectTypeIndex = SUBJECT_TYPE_OPTIONS.findIndex((item) => item.value === options.type);
    const type = SUBJECT_TYPE_OPTIONS[subjectTypeIndex] ?? SUBJECT_TYPE_OPTIONS[0];
    const keyword = Array.from((options.keyword ?? "").trim())
      .slice(0, 64)
      .join("");
    this.setData({
      tab,
      subjectType: type.value,
      subjectTypeIndex: subjectTypeIndex < 0 ? 0 : subjectTypeIndex,
      subjectTypeLabel: type.label,
      keyword,
      keywordInput: keyword,
    });
    this.updatePageTitle();
    void this.loadFirstPage();
  },

  onShareAppMessage() {
    return discoverShare(this.data.tab, this.data.subjectType, this.data.keyword).friend;
  },

  onShareTimeline() {
    return discoverShare(this.data.tab, this.data.subjectType, this.data.keyword).timeline;
  },

  updatePageTitle() {
    wx.setNavigationBarTitle({
      title: this.data.keyword
        ? `搜索：${this.data.keyword}`
        : `${SUBJECT_TYPE_FILTER_LABELS[this.data.subjectType]}本年度热门`,
    });
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height });
  },

  onTabChange(event: WechatMiniprogram.CustomEvent<{ value: DiscoverTab }>) {
    const tab = event.detail.value;
    if (tab === this.data.tab) return;
    this.setData({ tab });
    this.updatePageTitle();
    void this.loadFirstPage();
  },

  onSubjectTypeChange(event: WechatMiniprogram.PickerChange) {
    const subjectTypeIndex = Number(event.detail.value);
    const option = SUBJECT_TYPE_OPTIONS[subjectTypeIndex];
    if (!option || option.value === this.data.subjectType) return;
    this.setData({
      subjectType: option.value,
      subjectTypeIndex,
      subjectTypeLabel: option.label,
    });
    this.updatePageTitle();
    void this.loadFirstPage();
  },

  onKeywordInput(event: WechatMiniprogram.Input) {
    this.setData({ keywordInput: event.detail.value });
  },

  onSearch() {
    if (this.data.loading) return;
    const keyword = this.data.keywordInput.trim();
    if (!keyword) return;
    if (!checkSearchKeyword(keyword)) return;
    this.setData({ keyword, keywordInput: keyword });
    this.updatePageTitle();
    void this.loadFirstPage();
  },

  onClearKeyword() {
    this.setData({ keyword: "", keywordInput: "" });
    this.updatePageTitle();
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
    const descriptor = getDiscoveryRequest(
      this.data.tab,
      this.data.subjectType,
      this.data.keyword,
      1,
    );
    if (!descriptor) {
      requestVersion += 1;
      this.setData({
        emptyDescription: "提交关键词后即可查看匹配结果。",
        emptyTitle: "输入关键词开始搜索",
        entities: [],
        errorMessage: "",
        footerState: "hidden",
        hasNext: false,
        loaded: true,
        loading: false,
        page: 0,
        posters: [],
      });
      return;
    }
    await this.loadPage(1, false);
  },

  async loadPage(page: number, append: boolean) {
    const tab = this.data.tab;
    const subjectType = this.data.subjectType;
    const keyword = this.data.keyword;
    const descriptor = getDiscoveryRequest(tab, subjectType, keyword, page);
    if (!descriptor) return;

    const version = ++requestVersion;
    this.setData({
      errorMessage: append ? this.data.errorMessage : "",
      footerState: append ? "loading" : "hidden",
      loadMoreError: false,
      loading: !append,
      loadingMore: append,
      ...(append ? {} : { entities: [], posters: [], loaded: false }),
    });

    try {
      const ttl = keyword ? SEARCH_STALE_TIME : POPULAR_STALE_TIME;
      const result = await publicPageCache.load(
        getDiscoveryCacheKey(tab, subjectType, keyword, page),
        ttl,
        () => requestJson<DiscoveryResultPage>(descriptor.path, descriptor.query),
      );
      if (version !== requestVersion) return;

      const hasNext = result.hasNext && page < MAX_DISCOVERY_PAGE;
      const incoming =
        tab === "subjects"
          ? (result.data as SubjectSummary[]).map(toPosterViewModel)
          : tab === "characters"
            ? (result.data as DiscoveryCharacterSummary[]).map(toCharacterViewModel)
            : (result.data as DiscoveryPersonSummary[]).map(toPersonViewModel);
      const key = tab === "subjects" ? "posters" : "entities";
      const { length: itemCount, patch } = pagePatch<{ id: number }>(
        key,
        this.data[key],
        incoming,
        append,
      );
      const searched = Boolean(keyword);
      this.setData({
        emptyDescription: searched ? "可以尝试其他关键词。" : "可以切换其他条目类型继续浏览。",
        emptyTitle: searched ? "没有找到匹配结果" : "暂无本年度热门条目",
        // 首页结果整体替换，另一类结果清空；追加时只下发新增项。
        ...(append ? {} : { entities: [], posters: [] }),
        ...patch,
        errorMessage: "",
        footerState: getFooterState(itemCount, true, false, false),
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
        const itemCount = tab === "subjects" ? this.data.posters.length : this.data.entities.length;
        this.setData({
          footerState: getFooterState(itemCount, true, false, true),
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
