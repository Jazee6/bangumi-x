/// <reference path="./types/index.d.ts" />

declare namespace WechatMiniprogram {
  interface WindowInfo {
    statusBarHeight: number;
    windowWidth: number;
  }

  interface Wx {
    getAppBaseInfo(): { theme?: "light" | "dark" };
    getWindowInfo(): WindowInfo;
  }
}

interface IAppOption {
  globalData: Record<string, never>;
}
