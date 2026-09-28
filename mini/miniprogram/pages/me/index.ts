import type { MiniIdentityUser } from "share";

import { getMiniIdentity, getUserInitial } from "../../lib/mini-identity";
import { loadPersonalRecordCounts } from "../../lib/personal-records";
import { getErrorMessage } from "../../lib/request";

Page({
  data: {
    collectionCount: 0,
    errorMessage: "",
    headerHeight: 0,
    loaded: false,
    loading: true,
    progressCount: 0,
    user: null as MiniIdentityUser | null,
    userInitial: "番",
  },

  loadVersion: 0,

  // 切回 tab 时静默刷新：已有数据时不切换到加载或错误状态。
  onShow() {
    void this.loadIdentity(this.data.loaded);
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height });
  },

  onRetry() {
    void this.loadIdentity();
  },

  onOpenProfile() {
    wx.navigateTo({ url: "/packages/me/profile/index" });
  },

  onOpenCollections() {
    wx.navigateTo({ url: "/packages/me/collections/index" });
  },

  onOpenProgress() {
    wx.navigateTo({ url: "/packages/me/progress/index" });
  },

  onOpenAbout() {
    wx.navigateTo({ url: "/packages/me/about/index" });
  },

  async loadIdentity(silent = false) {
    const version = ++this.loadVersion;
    if (!silent) this.setData({ errorMessage: "", loading: true });
    try {
      const [user, counts] = await Promise.all([
        getMiniIdentity(),
        loadPersonalRecordCounts().catch(() => null),
      ]);
      if (version !== this.loadVersion) return;
      this.setData({
        collectionCount: counts?.collections.all ?? 0,
        loaded: true,
        loading: false,
        progressCount: counts?.progress.in_progress ?? 0,
        user,
        userInitial: getUserInitial(user.name),
      });
    } catch (error) {
      if (version !== this.loadVersion || silent) return;
      this.setData({
        errorMessage: getErrorMessage(error),
        loaded: false,
        loading: false,
        user: null,
      });
    }
  },
});
