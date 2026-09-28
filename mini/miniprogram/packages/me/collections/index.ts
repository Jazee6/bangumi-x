import {
  CANONICAL_WEB_ORIGIN,
  type CollectionItem,
  type CollectionList,
  type SubjectTypeFilter,
} from "share";

import { getMiniSession } from "../../../lib/mini-auth";
import { openDetail } from "../../../lib/detail-pages";
import {
  createCollectionList,
  deleteCollectionList,
  getPersonalRecordsRevision,
  loadCollectionLists,
  loadCollections,
  loadPersonalRecordCounts,
  PERSONAL_TYPE_OPTIONS,
  renameCollectionList,
  setCollectionListVisibility,
} from "../../../lib/personal-records";
import { getErrorMessage } from "../../../lib/request";
import { pagePatch } from "../../../lib/public-pages";
import { checkCollectionListName, checkSearchKeyword } from "../../../lib/validation";
import { collectionShare, ogImage } from "../../../lib/public-sharing";

interface CollectionCardViewModel {
  id: number;
  imageUrl: string;
  title: string;
}

type SheetMode = "" | "manage";

function toCard(item: CollectionItem): CollectionCardViewModel {
  return { id: item.id, imageUrl: item.imageUrl ?? "", title: item.title };
}

Page({
  // 请求版本挂在页面实例上，同一页面多次打开时互不丢弃对方的响应。
  requestVersion: 0,
  // 最近一次完整加载时的个人记录修订号，返回页面时据此判断是否需要刷新。
  seenRevision: -1,
  // 列表元数据只在逻辑层使用，不传给渲染层。
  lists: [] as CollectionList[],
  data: {
    errorMessage: "",
    footerState: "hidden" as "error" | "hidden" | "loading",
    hasNext: false,
    headerHeight: 0,
    items: [] as CollectionCardViewModel[],
    keyword: "",
    keywordInput: "",
    loaded: false,
    loading: true,
    loadingMore: false,
    page: 0,
    scope: "all",
    scopeTabs: [] as Array<{ count: string; label: string; value: string }>,
    selectedList: null as CollectionList | null,
    sheetMode: "" as SheetMode,
    sheetOpen: false,
    sheetTitle: "",
    submitting: false,
    type: "all" as "all" | SubjectTypeFilter,
    typeIndex: 0,
    typeLabels: PERSONAL_TYPE_OPTIONS.map((option) => option.label),
  },

  onLoad() {
    wx.hideShareMenu({ menus: ["shareAppMessage", "shareTimeline"] });
    void this.refresh(false);
  },

  onShow() {
    if (this.data.loaded && this.seenRevision !== getPersonalRecordsRevision()) {
      void this.refresh(true);
    }
  },

  onBack() {
    if (this.data.sheetOpen) {
      this.closeSheet();
      return;
    }
    wx.navigateBack();
  },

  onShareAppMessage() {
    const list = this.data.selectedList;
    const ownerName = getMiniSession()?.user.name ?? "番迹";
    return list?.isPublic
      ? collectionShare(list.shareId, list.name, ownerName).friend
      : {
          title: "每日放送 · 番迹",
          path: "/pages/index/index",
          imageUrl: ogImage("/og/brand", "friend"),
        };
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height });
  },

  onSelectScope(event: WechatMiniprogram.CustomEvent<{ value: string }>) {
    const scope = event.detail.value || "all";
    if (scope === this.data.scope) return;
    this.setData({ scope });
    this.syncSelectedList();
    void this.loadFirstPage();
  },

  onOpenSubject(event: WechatMiniprogram.CustomEvent<{ id: number }>) {
    openDetail("subject", event.detail.id);
  },

  onScrollLower() {
    if (!this.data.hasNext || this.data.loadingMore || this.data.footerState === "error") return;
    void this.loadPage(this.data.page + 1, true);
  },

  onRetry() {
    void this.refresh(false);
  },

  onRetryMore() {
    if (!this.data.loadingMore) void this.loadPage(this.data.page + 1, true);
  },

  async onOpenCreate() {
    if (this.data.submitting) return;
    const { confirm, content } = await wx.showModal({
      title: "新建收藏列表",
      editable: true,
      placeholderText: "列表名称",
      confirmText: "创建",
    });
    if (confirm) void this.onCreateList(content.trim());
  },

  onOpenManage() {
    if (!this.data.selectedList || this.data.submitting) return;
    this.openSheet("manage", "管理收藏列表");
  },

  async onEditListName() {
    const list = this.data.selectedList;
    if (!list || this.data.submitting) return;
    const { confirm, content } = await wx.showModal({
      title: "修改列表名称",
      content: list.name,
      editable: true,
      placeholderText: "列表名称",
      confirmText: "保存",
    });
    if (confirm && this.data.selectedList?.id === list.id) void this.onRenameList(content.trim());
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

  async onCreateList(name: string) {
    if (this.data.submitting || !checkCollectionListName(name)) return;
    this.setData({ submitting: true });
    try {
      const list = await createCollectionList(name);
      await this.loadMeta();
      this.setData({ scope: list.id });
      this.syncSelectedList();
      await this.loadFirstPage();
      wx.showToast({ title: "收藏列表已创建", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async onRenameList(name: string) {
    const list = this.data.selectedList;
    if (!list || this.data.submitting || !checkCollectionListName(name) || name === list.name)
      return;
    this.setData({ submitting: true });
    try {
      await renameCollectionList(list.id, name);
      await this.loadMeta();
      this.syncSelectedList();
      wx.showToast({ title: "列表已重命名", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  async onToggleVisibility() {
    const list = this.data.selectedList;
    if (!list || this.data.submitting) return;
    const isPublic = !list.isPublic;
    const { confirm } = await wx.showModal({
      title: isPublic ? "设为公开列表？" : "设为私密列表？",
      content: isPublic
        ? "设为公开后，收藏列表和你的站内显示名将对获得链接的人可见。公开内容变更最多可能延迟 5 分钟。"
        : "设为私密后，其他人将无法通过分享链接访问该列表。公开内容变更最多可能延迟 5 分钟。",
      confirmText: isPublic ? "公开" : "私密",
    });
    const current = this.data.selectedList;
    if (
      confirm &&
      !this.data.submitting &&
      current?.id === list.id &&
      current.isPublic === list.isPublic
    ) {
      void this.updateVisibility(isPublic);
    }
  },

  async onRequestDelete() {
    const list = this.data.selectedList;
    if (!list || this.data.submitting) return;
    const { confirm } = await wx.showModal({
      title: "删除收藏列表？",
      content: "列表和其中的整理关系会被删除，收藏记录会保留。",
      confirmText: "删除",
    });
    if (!confirm || this.data.selectedList?.id !== list.id) return;
    this.setData({ submitting: true });
    try {
      await deleteCollectionList(list.id);
      this.setData({ scope: "all" });
      this.closeSheet();
      await this.loadMeta();
      this.syncSelectedList();
      await this.loadFirstPage();
      wx.showToast({ title: "列表已删除", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  onCopyWebLink() {
    const list = this.data.selectedList;
    if (!list?.isPublic) return;
    wx.setClipboardData({ data: `${CANONICAL_WEB_ORIGIN}/s/${list.shareId}` });
  },

  onPreviewPublicList() {
    const list = this.data.selectedList;
    if (!list?.isPublic) return;
    wx.navigateTo({
      url: `/pages/collections/shared/index?shareId=${encodeURIComponent(list.shareId)}`,
    });
  },

  onCloseSheet() {
    if (!this.data.submitting) this.closeSheet();
  },

  onSheetClosed() {
    if (!this.data.sheetOpen) this.setData({ sheetMode: "", sheetTitle: "" });
  },

  onSheetDismissed() {
    this.setData({ sheetOpen: false, sheetMode: "", sheetTitle: "" });
  },

  // 后台刷新重新加载已加载的全部页，保留列表长度和滚动位置。
  async refresh(background: boolean) {
    const version = ++this.requestVersion;
    const revision = getPersonalRecordsRevision();
    this.setData({ errorMessage: "", loading: !background });
    try {
      await this.loadMeta();
      if (version !== this.requestVersion) return;
      this.syncSelectedList();
      if (!background) {
        await this.loadPage(1, false);
        return;
      }
      const pageCount = Math.max(1, this.data.page);
      const results = await Promise.all(
        Array.from({ length: pageCount }, (_, index) => loadCollections(index + 1, this.filters())),
      );
      if (version !== this.requestVersion) return;
      this.seenRevision = revision;
      this.setData({
        footerState: "hidden",
        hasNext: results[results.length - 1]?.hasNext ?? false,
        items: results.flatMap((result) => result.data.map(toCard)),
        loading: false,
        loadingMore: false,
        page: pageCount,
      });
    } catch (error) {
      if (version !== this.requestVersion) return;
      this.setData({
        errorMessage: this.data.loaded ? "" : getErrorMessage(error),
        loading: false,
      });
      if (this.data.loaded) wx.showToast({ title: getErrorMessage(error), icon: "none" });
    }
  },

  async loadMeta() {
    const [listsResult, counts] = await Promise.all([
      loadCollectionLists(),
      loadPersonalRecordCounts(),
    ]);
    const lists = listsResult.data;
    const scopeTabs = [
      { count: String(counts.collections.all), label: "全部", value: "all" },
      ...(counts.collections.unlisted > 0
        ? [
            {
              count: String(counts.collections.unlisted),
              label: "未归入列表",
              value: "unlisted",
            },
          ]
        : []),
      ...lists.map((list) => ({
        count: String(list.count ?? 0),
        label: list.name,
        value: list.id,
      })),
    ];
    const scopeExists = scopeTabs.some((tab) => tab.value === this.data.scope);
    this.lists = lists;
    this.setData({ scope: scopeExists ? this.data.scope : "all", scopeTabs });
  },

  loadFirstPage() {
    return this.loadPage(1, false);
  },

  filters() {
    return {
      keyword: this.data.keyword || undefined,
      list: this.data.scope === "all" ? undefined : this.data.scope,
      type: this.data.type === "all" ? undefined : this.data.type,
    };
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
      const result = await loadCollections(page, this.filters());
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

  syncSelectedList() {
    const selectedList =
      this.lists.find((list: CollectionList) => list.id === this.data.scope) ?? null;
    this.setData({ selectedList });
  },

  async updateVisibility(isPublic: boolean) {
    const list = this.data.selectedList;
    if (!list) return;
    this.setData({ submitting: true });
    try {
      const updated = await setCollectionListVisibility(list.id, isPublic);
      await this.loadMeta();
      this.setData({ selectedList: updated });
      wx.showToast({ title: isPublic ? "已设为公开" : "已设为私密", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ submitting: false });
    }
  },

  openSheet(sheetMode: SheetMode, sheetTitle: string) {
    this.setData({ sheetMode, sheetOpen: true, sheetTitle });
  },

  closeSheet() {
    this.setData({ sheetOpen: false });
  },
});
