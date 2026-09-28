import type { DetailBadge } from "../../lib/detail-pages";

const titleObservers = new WeakMap<object, WechatMiniprogram.IntersectionObserver>();

Component({
  properties: {
    badges: { type: Array, value: [] as unknown as DetailBadge[] },
    imageUrl: { type: String, value: "" },
    imageVariant: { type: String, value: "poster" },
    headerHeight: { type: Number, value: 0 },
    showImage: { type: Boolean, value: true },
    originalTitle: { type: String, value: "" },
    summary: { type: String, value: "" },
    tags: { type: Array, value: [] as unknown as string[] },
    title: { type: String, value: "" },
  },
  data: {
    imageFailed: false,
    observerReady: false,
    titleHidden: false,
    summaryCollapsible: false,
    summaryExpanded: false,
  },
  observers: {
    "headerHeight, observerReady"(height: number, ready: boolean) {
      if (ready && height > 0) this.observeTitle(height);
    },
    imageUrl() {
      this.setData({ imageFailed: false });
    },
    summary() {
      const summary = this.properties.summary;
      this.setData({
        summaryCollapsible: summary.length > 150 || summary.split("\n").length > 6,
        summaryExpanded: false,
      });
    },
  },
  methods: {
    observeTitle(height: number) {
      titleObservers.get(this)?.disconnect();
      const observer = this.createIntersectionObserver({ thresholds: [0] });
      titleObservers.set(this, observer);
      observer.relativeToViewport({ top: -height }).observe(".detail-hero__title-row", (result) => {
        const hidden = result.boundingClientRect.bottom <= height;
        if (hidden === this.data.titleHidden) return;
        this.setData({ titleHidden: hidden });
        this.triggerEvent("titlevisibilitychange", { hidden });
      });
    },
    // widthFix 竖图加载前高度为 0，加载失败时图片区域整体移除；
    // Skyline 不会因为布局位移重新回调观察器，两种情况都需重新观察。
    onImageLoad() {
      this.onMediaLayoutChange();
    },
    onImageError() {
      this.setData({ imageFailed: true }, () => this.onMediaLayoutChange());
    },
    onMediaLayoutChange() {
      const height = this.properties.headerHeight;
      if (this.data.observerReady && height > 0) this.observeTitle(height);
      this.triggerEvent("medialayoutchange");
    },
    onCopyTitle() {
      const title = this.properties.title;
      if (!title) return;
      wx.setClipboardData({ data: title });
    },
    onToggleSummary() {
      this.setData({ summaryExpanded: !this.data.summaryExpanded });
    },
  },
  lifetimes: {
    ready() {
      this.setData({ observerReady: true });
    },
    detached() {
      titleObservers.get(this)?.disconnect();
      titleObservers.delete(this);
    },
  },
});
