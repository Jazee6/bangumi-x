type ThemedInstance = WechatMiniprogram.Page.Instance<
  WechatMiniprogram.Page.DataOption,
  WechatMiniprogram.Page.CustomOption
>;

export type LayoutMode = "compact" | "expanded";

const EXPANDED_THRESHOLD = 600;

export function computeLayoutMode(): LayoutMode {
  const win = wx.getWindowInfo();
  return win.windowWidth >= EXPANDED_THRESHOLD ? "expanded" : "compact";
}

export function applyLayout(this: ThemedInstance): void {
  const mode = computeLayoutMode();
  const app = getApp<{ globalData: { layoutMode: LayoutMode } }>();
  if (app?.globalData) app.globalData.layoutMode = mode;
  this.setData({ expanded: mode === "expanded" });
}
