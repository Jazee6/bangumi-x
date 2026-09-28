export const DEVELOPMENT_SERVER_URL_STORAGE_KEY = "bangumi-x:development-server-url";
export const LOCAL_SERVER_URL = "http://127.0.0.1:8787";
export const PRODUCTION_SERVER_URL = "https://s.bgmx.jaze.top";

export type MiniEnvironment = "develop" | "trial" | "release";

function normalizeServerUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().replace(/\/+$/, "");
  return /^https?:\/\/[^/]+(?::\d+)?(?:\/.*)?$/.test(normalized) ? normalized : null;
}

// 审核环境的 envVersion 可能报告为 develop，因此只有在开发者工具或显式设置了调试地址时才使用非生产地址。
export function resolveServerUrl(
  environment: MiniEnvironment,
  developmentOverride?: unknown,
  isDevtools = false,
): string {
  if (environment !== "develop") return PRODUCTION_SERVER_URL;
  return (
    normalizeServerUrl(developmentOverride) ??
    (isDevtools ? LOCAL_SERVER_URL : PRODUCTION_SERVER_URL)
  );
}

function isRunningInDevtools(): boolean {
  const { getDeviceInfo } = wx as unknown as { getDeviceInfo?: () => { platform?: string } };
  return getDeviceInfo?.().platform === "devtools";
}

export function getServerUrl(): string {
  const environment = wx.getAccountInfoSync().miniProgram.envVersion as MiniEnvironment;
  if (environment !== "develop") return PRODUCTION_SERVER_URL;
  return resolveServerUrl(
    environment,
    wx.getStorageSync(DEVELOPMENT_SERVER_URL_STORAGE_KEY),
    isRunningInDevtools(),
  );
}
