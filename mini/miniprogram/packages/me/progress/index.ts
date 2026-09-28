import {
  supportsChapterProgress,
  type PersonalRecordCounts,
  type ProgressItem,
  type ProgressStage,
  type SubjectProgress,
  type SubjectTypeFilter,
} from "share";

import { getBroadcastBadge, openDetail } from "../../../lib/detail-pages";
import {
  clearProgress,
  getPersonalRecordsRevision,
  loadProgress,
  loadPersonalRecordCounts,
  PERSONAL_TYPE_OPTIONS,
  saveProgress,
} from "../../../lib/personal-records";
import { getErrorMessage } from "../../../lib/request";
import { pagePatch } from "../../../lib/public-pages";
import { checkSearchKeyword } from "../../../lib/validation";
import { vibrateForRecordChange } from "../../../lib/touch-feedback";

// 只把渲染需要的字段交给渲染层，放送章节等原始数据留在逻辑层。
interface ProgressCardViewModel {
  broadcastLabel: string;
  canReturnToOngoing: boolean;
  completedChapters: number | null;
  hasChapters: boolean;
  id: number;
  imageUrlValue: string;
  stage: ProgressStage;
  title: string;
  totalChapters: number | null;
  type: ProgressItem["type"];
}

function getStageTabs(counts: PersonalRecordCounts["progress"] | null) {
  return [
    { count: counts ? String(counts.in_progress) : "", label: "进行中", value: "in_progress" },
    { count: counts ? String(counts.completed) : "", label: "已完成", value: "completed" },
  ];
}

function canReturnToOngoing(
  progress: Pick<SubjectProgress, "completedChapters" | "stage" | "totalChapters">,
) {
  return (
    progress.stage !== "completed" ||
    progress.totalChapters === null ||
    progress.totalChapters <= 0 ||
    (progress.completedChapters ?? 0) < progress.totalChapters
  );
}

function toCard(item: ProgressItem): ProgressCardViewModel {
  return {
    broadcastLabel: getBroadcastBadge(item.broadcast) ?? "",
    canReturnToOngoing: canReturnToOngoing(item),
    completedChapters: item.completedChapters,
    hasChapters: supportsChapterProgress(item.type),
    id: item.id,
    imageUrlValue: item.imageUrl ?? "",
    stage: item.stage,
    title: item.title,
    totalChapters: item.totalChapters,
    type: item.type,
  };
}

Page({
  // 请求版本挂在页面实例上，同一页面多次打开时互不丢弃对方的响应。
  requestVersion: 0,
  countsVersion: 0,
  // 最近一次完整加载时的个人记录修订号，返回页面时据此判断是否需要刷新。
  seenRevision: -1,
  data: {
    errorMessage: "",
    footerState: "hidden" as "error" | "hidden" | "loading",
    hasNext: false,
    headerHeight: 0,
    items: [] as ProgressCardViewModel[],
    keyword: "",
    keywordInput: "",
    loaded: false,
    loading: true,
    loadingMore: false,
    mutatingAction: "" as "" | "chapter" | "stage" | "clear",
    mutatingId: 0,
    page: 0,
    stage: "in_progress" as ProgressStage,
    selectedStage: "in_progress" as ProgressStage,
    stageTabs: getStageTabs(null),
    type: "all" as "all" | SubjectTypeFilter,
    typeIndex: 0,
    typeLabels: PERSONAL_TYPE_OPTIONS.map((option) => option.label),
  },

  onLoad() {
    void this.refreshCounts();
    void this.loadFirstPage();
  },

  onShow() {
    if (this.data.loaded && this.seenRevision !== getPersonalRecordsRevision()) {
      void this.refreshCounts();
      void this.reloadLoadedPages();
    }
  },

  onBack() {
    wx.navigateBack();
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height });
  },

  onStageChange(event: WechatMiniprogram.CustomEvent<{ value: ProgressStage }>) {
    const stage = event.detail.value;
    if (stage === this.data.selectedStage) return;
    this.setData({ selectedStage: stage, stage, loaded: false, items: [], errorMessage: "" });
    void this.loadFirstPage();
  },

  onOpenSubject(event: WechatMiniprogram.TouchEvent) {
    const id = Number(event.currentTarget.dataset.id);
    if (id > 0) openDetail("subject", id);
  },

  onTypeChange(event: WechatMiniprogram.PickerChange) {
    const typeIndex = Number(event.detail.value);
    const option = PERSONAL_TYPE_OPTIONS[typeIndex];
    if (!option || option.value === this.data.type) return;
    this.setData({ type: option.value, typeIndex });
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
    void this.loadFirstPage();
  },

  onClearKeyword() {
    this.setData({ keyword: "", keywordInput: "" });
    void this.loadFirstPage();
  },

  onProgressStep(event: WechatMiniprogram.CustomEvent<{ value: number }>) {
    const id = Number(event.currentTarget.dataset.id);
    void this.updateProgress(id, { completedChapters: event.detail.value });
  },

  onChapterConfirm(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const id = Number(event.currentTarget.dataset.id);
    const item = this.data.items.find((candidate) => candidate.id === id);
    if (!item || !supportsChapterProgress(item.type) || this.data.mutatingId) return;
    const value = event.detail.value.trim();
    const chapters = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(chapters)) {
      wx.showToast({ title: "请输入非负整数", icon: "none" });
      return;
    }
    if (chapters !== (item.completedChapters ?? 0)) {
      void this.updateProgress(id, { completedChapters: chapters });
    }
  },

  onToggleStage(event: WechatMiniprogram.CustomEvent) {
    const id = Number(event.currentTarget.dataset.id);
    const item = this.data.items.find((candidate) => candidate.id === id);
    if (!item || this.data.mutatingId) return;
    if (!item.canReturnToOngoing) {
      wx.showToast({ title: "请先减少已完成章节数", icon: "none" });
      return;
    }
    void this.updateProgress(id, {
      stage: item.stage === "in_progress" ? "completed" : "in_progress",
    });
  },

  onOpenMore(event: WechatMiniprogram.CustomEvent) {
    const id = Number(event.currentTarget.dataset.id);
    const item = this.data.items.find((candidate) => candidate.id === id);
    if (!item || this.data.mutatingId) return;
    wx.showActionSheet({
      itemList: ["清除进度"],
      success: () => void this.onRequestClear(item),
    });
  },

  async updateProgress(id: number, update: { completedChapters?: number; stage?: ProgressStage }) {
    const item = this.data.items.find((candidate) => candidate.id === id);
    if (!item || this.data.mutatingId) return;
    if (update.completedChapters !== undefined) {
      const count = update.completedChapters;
      if (
        !supportsChapterProgress(item.type) ||
        !Number.isSafeInteger(count) ||
        count < 0 ||
        (item.totalChapters !== null && item.totalChapters > 0 && count > item.totalChapters)
      ) {
        wx.showToast({ title: "章节数超出范围", icon: "none" });
        return;
      }
    }
    this.setData({ mutatingAction: update.stage ? "stage" : "chapter", mutatingId: id });
    vibrateForRecordChange();
    try {
      const { progress } = await this.trackOwnWrite(saveProgress(id, update));
      // 章节数达到总数时服务端会同步进度阶段，以返回的阶段决定条目是否离开当前列表。
      if (progress.stage !== this.data.stage) {
        this.removeItem(id);
        void this.refreshCounts();
      } else {
        this.patchItem(id, progress);
      }
      wx.showToast({ title: "进度已更新", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ mutatingAction: "", mutatingId: 0 });
    }
  },

  async onRequestClear(item: ProgressCardViewModel) {
    if (this.data.mutatingId) return;
    const { confirm } = await wx.showModal({
      title: `清除“${item.title}”的进度？`,
      content: "进度记录将被删除，收藏记录不会受到影响。",
      confirmText: "清除",
    });
    if (!confirm || this.data.mutatingId || !this.data.items.some((row) => row.id === item.id))
      return;
    vibrateForRecordChange();
    this.setData({ mutatingAction: "clear", mutatingId: item.id });
    try {
      await this.trackOwnWrite(clearProgress(item.id));
      this.removeItem(item.id);
      void this.refreshCounts();
      wx.showToast({ title: "进度已清除", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ mutatingAction: "", mutatingId: 0 });
    }
  },

  onScrollLower() {
    if (!this.data.hasNext || this.data.loadingMore || this.data.footerState === "error") return;
    void this.loadPage(this.data.page + 1, true);
  },

  onRetry() {
    void this.refreshCounts();
    void this.loadFirstPage();
  },

  onRetryMore() {
    if (!this.data.loadingMore) void this.loadPage(this.data.page + 1, true);
  },

  async refreshCounts() {
    const version = ++this.countsVersion;
    try {
      const counts = await loadPersonalRecordCounts();
      if (version === this.countsVersion)
        this.setData({ stageTabs: getStageTabs(counts.progress) });
    } catch {
      // Counts are supplementary; list loading remains available.
    }
  },

  // 本页自己的写入已在本地应用，不需要在返回时再刷新。
  async trackOwnWrite<T>(request: Promise<T>): Promise<T> {
    const before = getPersonalRecordsRevision();
    const result = await request;
    if (this.seenRevision === before) this.seenRevision = getPersonalRecordsRevision();
    return result;
  },

  patchItem(id: number, progress: SubjectProgress) {
    const index = this.data.items.findIndex((item) => item.id === id);
    const card = this.data.items[index];
    if (!card) return;
    this.setData({
      [`items[${index}]`]: {
        ...card,
        canReturnToOngoing: canReturnToOngoing(progress),
        completedChapters: progress.completedChapters,
        stage: progress.stage,
        totalChapters: progress.totalChapters,
      },
    });
  },

  // 本地移除会让服务端分页边界错位；还有后续页时在后台重新加载已加载的页，避免漏掉条目。
  removeItem(id: number) {
    this.setData({ items: this.data.items.filter((item) => item.id !== id) });
    if (this.data.hasNext) void this.reloadLoadedPages();
  },

  filters() {
    return {
      keyword: this.data.keyword || undefined,
      stage: this.data.stage,
      type: this.data.type === "all" ? undefined : this.data.type,
    };
  },

  loadFirstPage() {
    return this.loadPage(1, false);
  },

  // 静默重新加载已加载的全部页，保留列表长度和滚动位置。
  async reloadLoadedPages() {
    const version = ++this.requestVersion;
    const revision = getPersonalRecordsRevision();
    const pageCount = Math.max(1, this.data.page);
    try {
      const results = await Promise.all(
        Array.from({ length: pageCount }, (_, index) => loadProgress(index + 1, this.filters())),
      );
      if (version !== this.requestVersion) return;
      this.seenRevision = revision;
      this.setData({
        footerState: "hidden",
        hasNext: results[results.length - 1]?.hasNext ?? false,
        items: results.flatMap((result) => result.data.map(toCard)),
        loadingMore: false,
        page: pageCount,
      });
    } catch {
      // 保留当前列表；下次返回页面时会再次尝试。
    }
  },

  async loadPage(page: number, append: boolean) {
    const version = ++this.requestVersion;
    const revision = getPersonalRecordsRevision();
    this.setData({
      errorMessage: "",
      footerState: append ? "loading" : "hidden",
      loading: append ? this.data.loading : true,
      loadingMore: append,
      ...(append ? {} : { items: [], loaded: false }),
    });
    try {
      const result = await loadProgress(page, this.filters());
      if (version !== this.requestVersion) return;
      const { patch } = pagePatch("items", this.data.items, result.data.map(toCard), append);
      if (!append) this.seenRevision = revision;
      this.setData({
        ...patch,
        footerState: "hidden",
        hasNext: result.hasNext,
        loaded: true,
        loading: false,
        loadingMore: false,
        page,
      });
    } catch (error) {
      if (version !== this.requestVersion) return;
      if (append) {
        this.setData({ footerState: "error", loadingMore: false });
      } else {
        this.setData({ errorMessage: getErrorMessage(error), loading: false });
      }
    }
  },
});
