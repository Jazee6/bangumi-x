import { CANONICAL_WEB_ORIGIN } from "share";

import { APP_VERSION } from "./app-version";

const GITHUB_URL = "https://github.com/Jazee6/bangumi-x";
const AD_NOTICE = [
  "番迹在内容浏览页的页尾展示微信流量主广告，用于覆盖运营成本，不含付费功能。",
  "广告由微信投放，Bangumi X 不向广告方提供你的收藏、进度或账户信息。",
  "每日放送、发现、排行榜与各详情页只在内容末尾展示广告，不使用插屏、激励视频或开屏广告；Web 端不含广告。",
];

Page({
  data: {
    adNotice: AD_NOTICE,
    adNoticeOpen: false,
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

  onOpenAdNotice() {
    this.setData({ adNoticeOpen: true });
  },

  onCloseAdNotice() {
    this.setData({ adNoticeOpen: false });
  },

  onCopyWeb() {
    wx.setClipboardData({ data: CANONICAL_WEB_ORIGIN });
  },

  onCopyGithub() {
    wx.setClipboardData({ data: GITHUB_URL });
  },
});
