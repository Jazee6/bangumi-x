import { CANONICAL_WEB_ORIGIN } from "share";

import { APP_VERSION } from "../../../lib/app-version";

const GITHUB_URL = "https://github.com/Jazee6/bangumi-x";

Page({
  data: {
    githubUrl: GITHUB_URL,
    headerHeight: 0,
    version: APP_VERSION,
    webUrl: CANONICAL_WEB_ORIGIN,
  },

  onBack() {
    wx.navigateBack();
  },

  onHeaderHeightChange(event: WechatMiniprogram.CustomEvent<{ height: number }>) {
    this.setData({ headerHeight: event.detail.height });
  },

  onCopyWeb() {
    wx.setClipboardData({ data: CANONICAL_WEB_ORIGIN });
  },

  onCopyGithub() {
    wx.setClipboardData({ data: GITHUB_URL });
  },
});
