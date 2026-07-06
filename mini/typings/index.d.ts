/// <reference types="miniprogram-api-typings" />

interface AppGlobalData {
  systemTheme: "light" | "dark";
  dark: boolean;
}

interface IAppOption {
  globalData: AppGlobalData;
}
