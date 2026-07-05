import { proxy } from "hono/proxy";
import { version } from "../../package.json";

const BASE_URL = process.env.BGM_API_URL ?? "https://api.bgm.tv";
const USER_AGENT = `Jazee6/bangumi-x/${version}(https://github.com/Jazee6/bangumi-x)`;

export function bgmUrl(path: string, query?: Record<string, string | number | undefined>): string {
  const url = new URL(path, `${BASE_URL}/`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

export function bgmProxy(url: string, init?: RequestInit) {
  return proxy(url, {
    ...init,
    headers: {
      "User-Agent": USER_AGENT,
      ...init?.headers,
    },
  });
}
