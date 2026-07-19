import {
  getMiniAuthState,
  retryMiniIdentity,
  subscribeMiniAuth,
} from "../../utils/auth";
import { applyTheme, getCurrentDark } from "../../utils/page";
import { applyLayout } from "../../utils/layout";
import { acceptBindingPayload } from "../../utils/mini-binding";
import { buildBrandShare, buildBrandTimelineShare, enableShareMenu } from "../../utils/share";

const WEB_URL = "https://bgmx.jaze.top";
const GITHUB_URL = "https://github.com/Jazee6/bangumi-x";
let unsubscribeAuth: (() => void) | null = null;

function authData(state: ReturnType<typeof getMiniAuthState>) {
  return {
    authStatus: state.status,
    profileName: state.status === "bound" ? state.profile.name : "",
    profileImage: state.status === "bound" ? state.profile.image ?? "" : "",
  };
}

Page({
  data: {
    dark: getCurrentDark(),
    expanded: false,
    ...authData(getMiniAuthState()),
    webUrl: WEB_URL,
    githubUrl: GITHUB_URL,
  },
  onLoad() {
    enableShareMenu();
    unsubscribeAuth = subscribeMiniAuth((state) => this.setData(authData(state)));
  },
  onUnload() {
    unsubscribeAuth?.();
    unsubscribeAuth = null;
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
  onCopyGithubUrl() {
    wx.setClipboardData({
      data: GITHUB_URL,
      success: () => wx.showToast({ title: "GitHub 链接已复制", icon: "success" }),
    });
  },
  onRetryAuth() {
    void retryMiniIdentity();
  },
  onScanBinding() {
    wx.scanCode({
      scanType: ["qrCode"],
      success: (result) => {
        if (!acceptBindingPayload(result.result)) {
          wx.showToast({ title: "不是有效的绑定二维码", icon: "none" });
          return;
        }
        wx.navigateTo({ url: "/pages/binding/binding" });
      },
    });
  },
  onShareAppMessage() {
    return buildBrandShare("profile");
  },
  onShareTimeline() {
    return buildBrandTimelineShare("profile");
  },
});
