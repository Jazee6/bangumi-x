type ThemedInstance = WechatMiniprogram.Page.Instance<
  WechatMiniprogram.Page.DataOption,
  WechatMiniprogram.Page.CustomOption
>;

export type DetailType = "subject" | "character" | "person";

export function getCurrentDark(): boolean {
  const app = getApp<{ globalData: { dark: boolean } }>();
  return app?.globalData?.dark ?? false;
}

export function applyTheme(this: ThemedInstance): void {
  this.setData({ dark: getCurrentDark() });
}

export function navigateToDetail(type: DetailType, id: number): void {
  if (!id) return;
  wx.navigateTo({
    url: `/pages/${type}/${type}?id=${id}`,
  });
}
