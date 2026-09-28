import { watchNetworkStatus } from "./lib/network-status";

App<IAppOption>({
  globalData: {},

  onLaunch() {
    watchNetworkStatus();

    const updateManager = wx.getUpdateManager();
    updateManager.onUpdateReady(() => {
      wx.showModal({
        title: "更新提示",
        content: "新版本已准备好，是否重启小程序更新？",
        success({ confirm }) {
          if (confirm) updateManager.applyUpdate();
        },
      });
    });
  },
});
