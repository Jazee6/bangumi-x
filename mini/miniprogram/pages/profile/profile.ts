import { applyTheme, getCurrentDark } from "../../utils/page";
import { applyLayout } from "../../utils/layout";
import { buildBrandShare, buildBrandTimelineShare, enableShareMenu } from "../../utils/share";

const WEB_URL = "https://bgmx.jaze.top";

Page({
  data: {
    dark: getCurrentDark(),
    expanded: false,
    webUrl: WEB_URL,
  },
  onLoad() {
    enableShareMenu();
  },
  onShow() {
    applyTheme.call(this);
    applyLayout.call(this);
  },
  onThemeChange() {
    applyTheme.call(this);
  },
  onResize() {
    applyLayout.call(this);
  },
  onCopyWebUrl() {
    wx.setClipboardData({
      data: WEB_URL,
      success: () => wx.showToast({ title: "链接已复制", icon: "success" }),
    });
  },
  onShareAppMessage() {
    return buildBrandShare("profile");
  },
  onShareTimeline() {
    return buildBrandTimelineShare("profile");
  },
});
