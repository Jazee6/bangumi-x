App<IAppOption>({
  globalData: {
    systemTheme: "light",
    dark: false,
  },
  onLaunch() {
    const g = this.globalData;
    g.systemTheme = (wx.getAppBaseInfo().theme as "light" | "dark") ?? "light";
    g.dark = g.systemTheme === "dark";

    setTimeout(() => {
      wx.preloadSkylineView();
    }, 500);

    wx.onThemeChange((res) => {
      this.globalData.systemTheme = res.theme;
      this.globalData.dark = res.theme === "dark";
      const pages = getCurrentPages();
      const top = pages[pages.length - 1] as unknown as { onThemeChange?: () => void };
      if (top && typeof top.onThemeChange === "function") {
        top.onThemeChange();
      }
    });
  },
});
