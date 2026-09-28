import type { MiniIdentityUser } from "share";

import {
  getMiniIdentity,
  getUserInitial,
  updateMiniDisplayName,
  uploadMiniAvatar,
} from "../../../lib/mini-identity";
import { getErrorMessage } from "../../../lib/request";

Page({
  data: {
    accountLinkSheetMounted: false,
    sheetMode: "" as "" | "name" | "account",
    sheetOpen: false,
    errorMessage: "",
    headerHeight: 0,
    loaded: false,
    loading: true,
    nameDraft: "",
    nameError: "",
    savingName: false,
    uploadingAvatar: false,
    user: null as MiniIdentityUser | null,
    userInitial: "番",
  },

  // 选择头像、扫码等系统界面返回时也会触发 onShow；版本号让较早发出的加载不覆盖较新的资料。
  profileVersion: 0,

  onShow() {
    void this.loadProfile(this.data.loaded);
  },

  onBack() {
    wx.navigateBack();
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height });
  },

  onRetry() {
    void this.loadProfile();
  },

  onOpenAccountLink() {
    if (!this.data.user?.editable || this.data.sheetOpen) return;
    this.setData({ accountLinkSheetMounted: true, sheetMode: "account", sheetOpen: true });
  },

  onSheetClosed() {
    if (!this.data.sheetOpen) this.setData({ accountLinkSheetMounted: false, sheetMode: "" });
  },

  onSheetDismissed() {
    this.setData({ sheetOpen: false, accountLinkSheetMounted: false, sheetMode: "" });
  },

  onCloseSheet() {
    if (this.data.sheetMode === "name" && this.data.savingName) return;
    this.setData({ sheetOpen: false });
  },

  onAccountLinkComplete() {
    this.onCloseSheet();
    void this.loadProfile();
    wx.showToast({ title: "用户合并已完成", icon: "success" });
  },

  onEditName() {
    if (!this.data.user?.editable || this.data.savingName || this.data.sheetOpen) return;
    this.setData({
      nameDraft: this.data.user.name,
      nameError: "",
      sheetMode: "name",
      sheetOpen: true,
    });
  },

  onNameInput(event: WechatMiniprogram.Input) {
    this.setData({ nameDraft: event.detail.value, nameError: "" });
  },

  async onSaveName() {
    if (!this.data.user?.editable || this.data.savingName) return;
    const name = this.data.nameDraft.trim();
    const length = Array.from(name).length;
    if (length < 2 || length > 20) {
      this.setData({ nameError: "昵称需为 2 至 20 个字符" });
      return;
    }
    if (name === this.data.user.name) {
      this.onCloseSheet();
      return;
    }

    this.setData({ savingName: true });
    try {
      const user = await updateMiniDisplayName(name);
      this.setProfile(user);
      this.setData({ sheetOpen: false });
      wx.showToast({ title: "显示名已更新", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ savingName: false });
    }
  },

  async onChooseAvatar(event: WechatMiniprogram.CustomEvent<{ avatarUrl: string }>) {
    if (!this.data.user?.editable || this.data.uploadingAvatar) return;
    const filePath = event.detail.avatarUrl;
    if (!filePath) return;

    this.setData({ uploadingAvatar: true });
    try {
      const user = await uploadMiniAvatar(filePath);
      this.setProfile(user);
      wx.showToast({ title: "头像已提交审核", icon: "success" });
    } catch (error) {
      wx.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      this.setData({ uploadingAvatar: false });
    }
  },

  setProfile(user: MiniIdentityUser) {
    this.profileVersion += 1;
    this.setData({
      loaded: true,
      user,
      userInitial: getUserInitial(user.name),
    });
  },

  async loadProfile(silent = false) {
    const version = ++this.profileVersion;
    if (!silent) this.setData({ errorMessage: "", loading: true });
    try {
      const user = await getMiniIdentity();
      if (version !== this.profileVersion) return;
      this.setProfile(user);
      this.setData({ loading: false });
    } catch (error) {
      if (version !== this.profileVersion) return;
      if (silent) {
        wx.showToast({ title: getErrorMessage(error), icon: "none" });
        return;
      }
      this.setData({
        errorMessage: getErrorMessage(error),
        loaded: false,
        loading: false,
        user: null,
      });
    }
  },
});
