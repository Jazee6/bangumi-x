import type { ApiErrorCode, ApiErrorResponse } from "share";

import { getServerUrl } from "./config";
import { isOffline } from "./network-status";

export type QueryValue = boolean | number | string | null | undefined;
export type Query = Record<string, QueryValue>;
export type RequestMethod = "DELETE" | "GET" | "POST" | "PUT";

export interface ApiRequestOptions {
  data?: WechatMiniprogram.IAnyObject | string | ArrayBuffer;
  headers?: Record<string, string>;
  method?: RequestMethod;
  query?: Query;
  token?: string;
}

export class PublicApiError extends Error {
  readonly code: ApiErrorCode | null;
  readonly retryable: boolean;
  readonly statusCode: number;

  constructor(message: string, statusCode = 0, retryable = true, code: ApiErrorCode | null = null) {
    super(message);
    this.name = "PublicApiError";
    this.code = code;
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export function buildRequestUrl(baseUrl: string, path: string, query: Query = {}): string {
  const search = Object.entries(query)
    .filter((entry): entry is [string, boolean | number | string] => entry[1] != null)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");
  return `${baseUrl.replace(/\/+$/, "")}${path}${search ? `?${search}` : ""}`;
}

function isApiError(value: unknown): value is ApiErrorResponse {
  if (!value || typeof value !== "object") return false;
  const error = value as Partial<ApiErrorResponse>;
  return (
    typeof error.code === "string" &&
    typeof error.message === "string" &&
    typeof error.retryable === "boolean"
  );
}

function responseError(data: unknown, statusCode: number) {
  const error = isApiError(data) ? data : null;
  return new PublicApiError(
    error?.message ?? "请求失败，请稍后重试。",
    statusCode,
    error?.retryable ?? statusCode >= 500,
    error?.code ?? null,
  );
}

// 微信的 errMsg 是英文调试信息（如 "request:fail timeout"），不直接展示给用户。
export function transportError(errMsg: string | undefined, fallback: string) {
  const message = /timeout/i.test(errMsg ?? "") ? "网络请求超时，请稍后重试。" : fallback;
  return new PublicApiError(message);
}

export function requestApi<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const method = options.method ?? "GET";
  const headers: Record<string, string> = { ...options.headers };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  if (options.data !== undefined && !(options.data instanceof ArrayBuffer)) {
    headers["Content-Type"] ??= "application/json";
  }

  return new Promise((resolve, reject) => {
    wx.request<WechatMiniprogram.IAnyObject>({
      url: buildRequestUrl(getServerUrl(), path, options.query),
      method,
      ...(options.data === undefined ? {} : { data: options.data }),
      ...(Object.keys(headers).length === 0 ? {} : { header: headers }),
      timeout: 15_000,
      success(response) {
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(response.data as unknown as T);
          return;
        }
        reject(responseError(response.data as unknown, response.statusCode));
      },
      fail(error) {
        reject(transportError(error.errMsg, "网络连接失败，请稍后重试。"));
      },
    });
  });
}

export function requestJson<T>(path: string, query?: Query): Promise<T> {
  return requestApi<T>(path, { query });
}

export function uploadApiFile<T>(path: string, filePath: string, token: string): Promise<T> {
  return new Promise((resolve, reject) => {
    wx.uploadFile({
      url: buildRequestUrl(getServerUrl(), path),
      filePath,
      name: "avatar",
      header: { Authorization: `Bearer ${token}` },
      timeout: 30_000,
      success(response) {
        let data: unknown = response.data;
        try {
          data = response.data ? (JSON.parse(response.data) as unknown) : undefined;
        } catch {
          // Keep the response text so the generic error below can handle it.
        }
        if (response.statusCode >= 200 && response.statusCode < 300) {
          resolve(data as T);
          return;
        }
        reject(responseError(data, response.statusCode));
      },
      fail(error) {
        reject(transportError(error.errMsg, "头像上传失败，请稍后重试。"));
      },
    });
  });
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof PublicApiError && error.statusCode === 0 && isOffline()) {
    return "网络已断开，连接后请重试。";
  }
  return error instanceof Error && error.message ? error.message : "加载失败，请稍后重试。";
}
