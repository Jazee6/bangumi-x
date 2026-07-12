type ThemedInstance = WechatMiniprogram.Page.Instance<
  WechatMiniprogram.Page.DataOption,
  WechatMiniprogram.Page.CustomOption
>;

export function getCurrentDark(): boolean {
  const app = getApp<{ globalData: { dark: boolean } }>();
  return app?.globalData?.dark ?? false;
}

export function applyTheme(this: ThemedInstance): void {
  this.setData({ dark: getCurrentDark() });
}
