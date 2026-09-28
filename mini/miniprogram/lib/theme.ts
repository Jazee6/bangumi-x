export type Theme = "dark" | "light";

type ThemeListener = (theme: Theme) => void;

const listeners = new Set<ThemeListener>();
let current: Theme | null = null;

function readTheme(): Theme {
  const api = wx as WechatMiniprogram.Wx & { getAppBaseInfo?: () => { theme?: Theme } };
  return api.getAppBaseInfo?.().theme ?? "light";
}

function onThemeChange({ theme }: { theme: Theme }) {
  current = theme;
  for (const listener of listeners) listener(theme);
}

export function getTheme(): Theme {
  current ??= readTheme();
  return current;
}

// 全部图标共用一个系统监听，避免每个组件实例各自注册 wx.onThemeChange。
export function subscribeTheme(listener: ThemeListener): () => void {
  if (listeners.size === 0) wx.onThemeChange(onThemeChange);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) wx.offThemeChange(onThemeChange);
  };
}
