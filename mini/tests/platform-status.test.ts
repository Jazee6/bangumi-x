import { expect, test } from "bun:test";

import { isOffline, watchNetworkStatus } from "../miniprogram/lib/network-status";
import { getErrorMessage, PublicApiError } from "../miniprogram/lib/request";

test("network changes show connection hints and distinguish offline request failures", () => {
  const previousWx = globalThis.wx;
  let onChange: ((status: { isConnected: boolean }) => void) | undefined;
  let onInitial: ((status: { networkType: string }) => void) | undefined;
  const toasts: string[] = [];

  globalThis.wx = {
    onNetworkStatusChange(callback: typeof onChange) {
      onChange = callback;
    },
    getNetworkType({ success }: { success: typeof onInitial }) {
      onInitial = success;
    },
    showToast({ title }: { title: string }) {
      toasts.push(title);
    },
  } as unknown as typeof wx;

  try {
    watchNetworkStatus();
    onChange?.({ isConnected: false });
    onInitial?.({ networkType: "wifi" }); // Initial lookup must not overwrite a newer change.
    expect(isOffline()).toBe(true);
    expect(getErrorMessage(new PublicApiError("request:fail"))).toBe("网络已断开，连接后请重试。");
    expect(getErrorMessage(new PublicApiError("请求被拒绝", 403, false))).toBe("请求被拒绝");

    onChange?.({ isConnected: false });
    onChange?.({ isConnected: true });
    expect(isOffline()).toBe(false);
    expect(toasts).toEqual(["网络已断开，请检查连接", "网络已恢复，可重试"]);
  } finally {
    globalThis.wx = previousWx;
  }
});
