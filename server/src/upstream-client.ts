import { ApiError } from "./api-error";
import {
  createUpstreamCache,
  type UpstreamCachePolicy,
  type UpstreamCacheResult,
} from "./upstream-cache";

const MAX_CONCURRENCY = 4;
const MAX_REQUESTS_PER_MINUTE = 30;
const MAX_BACKGROUND_REQUESTS_PER_MINUTE = 15;
const MAX_MAINTENANCE_REQUESTS_PER_HOUR = 2;

export const UPSTREAM_CACHE_POLICIES = {
  schedule: { softTtlSeconds: 3600, hardTtlSeconds: 86400, fallbackTtlSeconds: 172800 },
  directory: {
    softTtlSeconds: 86400,
    hardTtlSeconds: 604800,
    fallbackTtlSeconds: 1209600,
  },
  subject: {
    softTtlSeconds: 86400,
    hardTtlSeconds: 604800,
    fallbackTtlSeconds: 1209600,
  },
  entity: {
    softTtlSeconds: 604800,
    hardTtlSeconds: 2592000,
    fallbackTtlSeconds: 5184000,
  },
  search: { softTtlSeconds: 600, hardTtlSeconds: 3600, fallbackTtlSeconds: 7200 },
} as const satisfies Record<string, UpstreamCachePolicy>;

/**
 * Foreground requests wait for a concurrency slot. Background work (deferred refreshes and
 * maintenance) never waits and may use at most half of the per-minute budget.
 */
export type UpstreamPriority = "foreground" | "background" | "maintenance";

export interface UpstreamLoadOptions {
  /** Only requests that arrived through Cloudflare spend the shared upstream budget. */
  gated: boolean;
  priority: UpstreamPriority;
  policy?: UpstreamCachePolicy;
  waitUntil?: (promise: Promise<unknown>) => void;
}

export interface UpstreamClient {
  load(request: Request, options: UpstreamLoadOptions): Promise<UpstreamCacheResult>;
}

export type UpstreamFetch = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

export class UpstreamUnavailableError extends Error {
  constructor() {
    super("Bangumi upstream is unavailable");
    this.name = "UpstreamUnavailableError";
  }
}

export function upstreamRateLimited() {
  return new ApiError(429, {
    code: "UPSTREAM_RATE_LIMITED",
    message: "上游请求繁忙，请稍后重试。",
  });
}

function defaultPolicy(request: Request): UpstreamCachePolicy {
  if (request.method !== "GET") return UPSTREAM_CACHE_POLICIES.search;
  const { pathname } = new URL(request.url);
  if (pathname.endsWith("/calendar")) return UPSTREAM_CACHE_POLICIES.schedule;
  if (pathname.endsWith("/v0/subjects")) return UPSTREAM_CACHE_POLICIES.directory;
  if (/\/v0\/subjects\/\d+$/.test(pathname)) return UPSTREAM_CACHE_POLICIES.subject;
  return UPSTREAM_CACHE_POLICIES.entity;
}

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export function createUpstreamClient(fetch: UpstreamFetch, now: () => Date): UpstreamClient {
  const loadCached = createUpstreamCache(now);
  const requestStarts: number[] = [];
  const backgroundStarts: number[] = [];
  const concurrencyWaiters: Array<() => void> = [];
  let activeRequests = 0;
  let maintenanceHour = -1;
  let maintenanceRequests = 0;

  async function acquireSlot(priority: UpstreamPriority) {
    const background = priority !== "foreground";
    if (background && activeRequests >= MAX_CONCURRENCY) throw upstreamRateLimited();
    while (activeRequests >= MAX_CONCURRENCY) {
      await new Promise<void>((resolve) => concurrencyWaiters.push(resolve));
    }
    const currentTime = now().getTime();
    const cutoff = currentTime - 60_000;
    while (requestStarts[0] !== undefined && requestStarts[0] < cutoff) requestStarts.shift();
    while (backgroundStarts[0] !== undefined && backgroundStarts[0] < cutoff) {
      backgroundStarts.shift();
    }
    const currentHour = Math.floor(currentTime / 3_600_000);
    if (currentHour !== maintenanceHour) {
      maintenanceHour = currentHour;
      maintenanceRequests = 0;
    }
    if (
      requestStarts.length >= MAX_REQUESTS_PER_MINUTE ||
      (background && backgroundStarts.length >= MAX_BACKGROUND_REQUESTS_PER_MINUTE) ||
      (priority === "maintenance" && maintenanceRequests >= MAX_MAINTENANCE_REQUESTS_PER_HOUR)
    ) {
      throw upstreamRateLimited();
    }
    activeRequests += 1;
    requestStarts.push(currentTime);
    if (background) backgroundStarts.push(currentTime);
    if (priority === "maintenance") maintenanceRequests += 1;
    return () => {
      activeRequests -= 1;
      concurrencyWaiters.shift()?.();
    };
  }

  async function fetchWithRetry(
    request: Request,
    gated: boolean,
    priority: UpstreamPriority,
  ): Promise<Response> {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const release = gated ? await acquireSlot(priority) : () => undefined;
      let response: Response | undefined;
      try {
        const body =
          request.method === "GET" || request.method === "HEAD"
            ? undefined
            : await request.clone().text();
        response = await fetch(request.url, {
          method: request.method,
          headers: request.headers,
          ...(body === undefined ? {} : { body }),
        });
      } catch {
        if (attempt === 1) throw new UpstreamUnavailableError();
      } finally {
        release();
      }

      if (!response) {
        await delay(100);
        continue;
      }
      if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
        const retryAfterHeader = response.headers.get("Retry-After");
        const retryAfter = retryAfterHeader === null ? Number.NaN : Number(retryAfterHeader);
        await delay(Number.isFinite(retryAfter) ? Math.min(retryAfter * 1000, 1000) : 100);
        continue;
      }
      return response;
    }
    throw new UpstreamUnavailableError();
  }

  return {
    load(request, { gated, priority, policy, waitUntil }) {
      return loadCached(
        request,
        policy ?? defaultPolicy(request),
        (nextRequest, revalidating) =>
          fetchWithRetry(
            nextRequest,
            gated,
            revalidating && priority === "foreground" ? "background" : priority,
          ),
        waitUntil,
      );
    },
  };
}
