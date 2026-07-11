/// <reference types="miniprogram-api-typings" />

interface AppGlobalData {
  systemTheme: "light" | "dark";
  dark: boolean;
  layoutMode: "compact" | "expanded";
}

interface IAppOption {
  globalData: AppGlobalData;
}
