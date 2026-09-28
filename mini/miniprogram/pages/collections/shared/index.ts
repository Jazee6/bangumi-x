import { CANONICAL_WEB_ORIGIN, type PublicCollectionListItem } from "share";

import {} from "../../../lib/detail-pages";
import { loadPublicCollectionList } from "../../../lib/personal-records";
import { collectionShare } from "../../../lib/public-sharing";
import { getErrorMessage } from "../../../lib/request";
import { pagePatch } from "../../../lib/public-pages";

interface PublicCardViewModel {
  id: number;
  imageUrl: string;
  title: string;
}

const titleObservers = new WeakMap<object, WechatMiniprogram.IntersectionObserver>();

function toCard(item: PublicCollectionListItem): PublicCardViewModel {
  return { id: item.id, imageUrl: item.imageUrl ?? "", title: item.title };
}

Page({
  // 请求版本挂在页面实例上，同一页面多次打开时互不丢弃对方的响应。
  requestVersion: 0,
  data: {
    actionsOpen: false,
    errorMessage: "",
    footerState: "hidden" as "error" | "hidden" | "loading",
    hasNext: false,
    headerHeight: 0,
    items: [] as PublicCardViewModel[],
    listName: "公开收藏列表",
    loaded: false,
    loading: true,
    loadingMore: false,
    ownerName: "",
    page: 0,
    shareId: "",
    summaryTitleHidden: false,
    titleObserverReady: false,
    total: 0,
    updatedLabel: "",
  },

  onLoad(options: Record<string, string | undefined>) {
    const shareId = options.shareId?.trim() ?? "";
    if (!shareId || shareId.length > 128) {
      this.setData({ errorMessage: "收藏列表不可访问。", loading: false });
      return;
    }
    this.setData({ shareId });
    void this.loadPage(1, false);
  },

  onReady() {
    this.setData({ titleObserverReady: true }, () => this.observeTitle());
  },

  onUnload() {
    titleObservers.get(this)?.disconnect();
    titleObservers.delete(this);
  },

  onBack() {
    if (this.data.actionsOpen) {
      this.onCloseActions();
      return;
    }
    wx.navigateBack({
      fail() {
        wx.switchTab({ url: "/pages/index/index" });
      },
    });
  },

  onShareAppMessage() {
    return collectionShare(this.data.shareId, this.data.listName, this.data.ownerName).friend;
  },

  onShareTimeline() {
    return collectionShare(this.data.shareId, this.data.listName, this.data.ownerName).timeline;
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height }, () => {
      if (this.data.loaded) this.observeTitle();
    });
  },

  observeTitle() {
    const height = this.data.headerHeight;
    if (!height || !this.data.titleObserverReady || !this.data.loaded || this.data.errorMessage)
      return;
    titleObservers.get(this)?.disconnect();
    const observer = this.createIntersectionObserver({ thresholds: [0] });
    titleObservers.set(this, observer);
    observer
      .relativeToViewport({ top: -height })
      .observe(".public-list-summary__title", (result) => {
        const hidden = result.boundingClientRect.bottom <= height;
        if (hidden !== this.data.summaryTitleHidden) this.setData({ summaryTitleHidden: hidden });
      });
  },

  onOpenActions() {
    this.setData({ actionsOpen: true });
  },

  onCloseActions() {
    this.setData({ actionsOpen: false });
  },

  onCopyWebLink() {
    wx.setClipboardData({ data: `${CANONICAL_WEB_ORIGIN}/s/${this.data.shareId}` });
    this.onCloseActions();
  },

  onScrollLower() {
    if (!this.data.hasNext || this.data.loadingMore || this.data.footerState === "error") return;
    void this.loadPage(this.data.page + 1, true);
  },

  onRetry() {
    if (this.data.shareId) void this.loadPage(1, false);
  },

  onRetryMore() {
    if (!this.data.loadingMore) void this.loadPage(this.data.page + 1, true);
  },

  async loadPage(page: number, append: boolean) {
    const version = ++this.requestVersion;
    this.setData({
      errorMessage: "",
      footerState: append ? "loading" : "hidden",
      loading: !append,
      loadingMore: append,
    });
    try {
      const result = await loadPublicCollectionList(this.data.shareId, page);
      if (version !== this.requestVersion) return;
      const { patch } = pagePatch("items", this.data.items, result.data.map(toCard), append);
      this.setData(
        {
          ...patch,
          footerState: "hidden",
          hasNext: result.hasNext,
          listName: result.name,
          loaded: true,
          loading: false,
          loadingMore: false,
          ownerName: result.ownerName,
          page,
          total: result.total,
          updatedLabel: new Date(result.updatedAt).toLocaleDateString("zh-CN"),
        },
        () => {
          if (page === 1) this.observeTitle();
        },
      );
      wx.setNavigationBarTitle({ title: result.name });
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
