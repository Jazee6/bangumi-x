let isConnected: boolean | null = null;

export function isOffline(): boolean {
  return isConnected === false;
}

export function watchNetworkStatus(): void {
  wx.onNetworkStatusChange(({ isConnected: connected }) => {
    if (isConnected === connected) return;
    const wasOffline = isConnected === false;
    isConnected = connected;
    if (!connected) {
      wx.showToast({ title: "网络已断开，请检查连接", icon: "none" });
    } else if (wasOffline) {
      wx.showToast({ title: "网络已恢复，可重试", icon: "none" });
    }
  });

  wx.getNetworkType({
    success({ networkType }) {
      // A change event may arrive before the initial query completes.
      if (isConnected === null) isConnected = networkType !== "none";
    },
  });
}
