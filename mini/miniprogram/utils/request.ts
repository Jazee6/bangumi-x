const API_BASE = "https://s.bgmx.jaze.top";

interface BgmFetchOpts {
  query?: Record<string, string | number | undefined>;
  method?: string;
  body?: unknown;
}

export function bgmFetch<T>(path: string, opts: BgmFetchOpts = {}): Promise<T> {
  const url = `${API_BASE}/bgm${path}`;
  const query = opts.query
    ? Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== "")
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join("&")
    : "";
  const fullUrl = query ? `${url}?${query}` : url;
  return new Promise<T>((resolve, reject) => {
    wx.request({
      url: fullUrl,
      method: (opts.method ?? "GET") as "GET" | "POST",
      header: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      data: opts.body !== undefined ? (opts.body as WechatMiniprogram.IAnyObject) : undefined,
      success: (res) => {
        const status = res.statusCode;
        if (status === 404) {
          resolve(null as T);
          return;
        }
        if (status < 200 || status >= 300) {
          reject(new Error(`bgmFetch ${path} failed: ${status}`));
          return;
        }
        resolve(res.data as T);
      },
      fail: (err) => reject(new Error(err.errMsg)),
    });
  });
}

export function proxyImageUrl(src: string | undefined): string {
  if (!src) return "";
  return `${API_BASE}/bgm/image?url=${encodeURIComponent(src)}`;
}
