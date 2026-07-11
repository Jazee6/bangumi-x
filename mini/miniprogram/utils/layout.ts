type ThemedInstance = WechatMiniprogram.Page.Instance<
  WechatMiniprogram.Page.DataOption,
  WechatMiniprogram.Page.CustomOption
>;

export type LayoutMode = "compact" | "expanded";

const EXPANDED_THRESHOLD = 600;

export function computeLayoutMode(): LayoutMode {
  const win = wx.getWindowInfo();
  const device = wx.getDeviceInfo() as WechatMiniprogram.DeviceInfo & { deviceType?: string };
  if (win.windowWidth >= EXPANDED_THRESHOLD && device.deviceType !== "phone") {
    return "expanded";
  }
  return "compact";
}

export function getCurrentLayout(): LayoutMode {
  const app = getApp<{ globalData: { layoutMode: LayoutMode } }>();
  return app?.globalData?.layoutMode ?? "compact";
}

export function applyLayout(this: ThemedInstance): void {
  this.setData({ expanded: getCurrentLayout() === "expanded" });
}
