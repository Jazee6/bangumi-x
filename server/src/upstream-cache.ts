export interface UpstreamCachePolicy {
  softTtlSeconds: number;
  hardTtlSeconds: number;
  fallbackTtlSeconds: number;
  notFoundTtlSeconds?: number;
}

/** `revalidating` is true when the fetch refreshes a stale entry after the response was served. */
export type UpstreamFetcher = (request: Request, revalidating: boolean) => Promise<Response>;

export type UpstreamCacheStatus = "bypass" | "miss" | "hit" | "stale" | "fallback";

export interface UpstreamCacheResult {
  response: Response;
  status: UpstreamCacheStatus;
  fetchedAt: Date;
}

interface ResponseSnapshot {
  body: ArrayBuffer;
  headers: [string, string][];
  status: number;
  statusText: string;
}

interface CachedMetadata {
  fetchedAt: Date;
  softExpiresAt: number;
  hardExpiresAt: number;
  fallbackExpiresAt: number;
}

const CACHE_NAME = "bangumi-upstream-v1";
const META_FETCHED_AT = "X-Bangumi-X-Fetched-At";
const META_SOFT_EXPIRES = "X-Bangumi-X-Soft-Expires";
const META_HARD_EXPIRES = "X-Bangumi-X-Hard-Expires";
const META_FALLBACK_EXPIRES = "X-Bangumi-X-Fallback-Expires";

function responseFromSnapshot(snapshot: ResponseSnapshot) {
  return new Response(snapshot.body.slice(0), {
    status: snapshot.status,
    statusText: snapshot.statusText,
    headers: snapshot.headers,
  });
}

async function snapshot(response: Response): Promise<ResponseSnapshot> {
  return {
    body: await response.arrayBuffer(),
    headers: [...response.headers.entries()],
    status: response.status,
    statusText: response.statusText,
  };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function cacheRequest(request: Request) {
  const body =
    request.method === "GET" || request.method === "HEAD" ? "" : await request.clone().text();
  const digest = await sha256(`${request.method}\n${request.url}\n${body}`);
  return new Request(`https://cache.bangumi-x.invalid/upstream/v1/${digest}`);
}

function readMetadata(response: Response): CachedMetadata | null {
  const fetchedAt = new Date(response.headers.get(META_FETCHED_AT) ?? "");
  const softExpiresAt = Number(response.headers.get(META_SOFT_EXPIRES));
  const hardExpiresAt = Number(response.headers.get(META_HARD_EXPIRES));
  const fallbackExpiresAt = Number(response.headers.get(META_FALLBACK_EXPIRES));
  if (
    Number.isNaN(fetchedAt.getTime()) ||
    !Number.isFinite(softExpiresAt) ||
    !Number.isFinite(hardExpiresAt) ||
    !Number.isFinite(fallbackExpiresAt)
  ) {
    return null;
  }
  return { fetchedAt, softExpiresAt, hardExpiresAt, fallbackExpiresAt };
}

function withMetadata(response: Response, now: Date, policy: UpstreamCachePolicy) {
  const notFound = response.status === 404;
  const softTtl = notFound ? (policy.notFoundTtlSeconds ?? 600) : policy.softTtlSeconds;
  const hardTtl = notFound ? softTtl : policy.hardTtlSeconds;
  const fallbackTtl = notFound ? softTtl : policy.fallbackTtlSeconds;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", `public, max-age=${fallbackTtl}`);
  headers.set(META_FETCHED_AT, now.toISOString());
  headers.set(META_SOFT_EXPIRES, String(now.getTime() + softTtl * 1000));
  headers.set(META_HARD_EXPIRES, String(now.getTime() + hardTtl * 1000));
  headers.set(META_FALLBACK_EXPIRES, String(now.getTime() + fallbackTtl * 1000));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function createUpstreamCache(now: () => Date) {
  const inFlight = new Map<string, Promise<ResponseSnapshot>>();

  async function cacheStorage() {
    if (typeof caches === "undefined") return undefined;
    try {
      return await caches.open(CACHE_NAME);
    } catch {
      return undefined;
    }
  }

  async function fetchOnce(
    key: Request,
    request: Request,
    policy: UpstreamCachePolicy,
    fetcher: UpstreamFetcher,
    revalidating = false,
  ): Promise<UpstreamCacheResult> {
    let pending = inFlight.get(key.url);
    if (!pending) {
      pending = (async () => {
        const fetched = await fetcher(request.clone(), revalidating);
        const cacheable = fetched.ok || fetched.status === 404;
        const response = cacheable ? withMetadata(fetched, now(), policy) : fetched;
        const stored = await snapshot(response);
        if (cacheable) {
          const storage = await cacheStorage();
          if (storage) await storage.put(key, responseFromSnapshot(stored));
        }
        return stored;
      })().finally(() => inFlight.delete(key.url));
      inFlight.set(key.url, pending);
    }
    const stored = await pending;
    const response = responseFromSnapshot(stored);
    const metadata = readMetadata(response);
    return {
      response,
      status: "miss",
      fetchedAt: metadata?.fetchedAt ?? now(),
    };
  }

  return async function load(
    request: Request,
    policy: UpstreamCachePolicy,
    fetcher: UpstreamFetcher,
    waitUntil?: (promise: Promise<unknown>) => void,
  ): Promise<UpstreamCacheResult> {
    const storage = await cacheStorage();
    if (!storage) {
      const response = await fetcher(request, false);
      return { response, status: "bypass", fetchedAt: now() };
    }

    const key = await cacheRequest(request);
    const cached = await storage.match(key);
    if (!cached) return fetchOnce(key, request, policy, fetcher);

    const metadata = readMetadata(cached);
    if (!metadata) {
      await storage.delete(key);
      return fetchOnce(key, request, policy, fetcher);
    }

    const currentTime = now().getTime();
    if (currentTime < metadata.softExpiresAt) {
      return { response: cached, status: "hit", fetchedAt: metadata.fetchedAt };
    }

    if (currentTime < metadata.hardExpiresAt) {
      const refresh = fetchOnce(key, request, policy, fetcher, true).then(
        () => undefined,
        () => undefined,
      );
      waitUntil?.(refresh);
      return { response: cached, status: "stale", fetchedAt: metadata.fetchedAt };
    }

    if (currentTime < metadata.fallbackExpiresAt) {
      try {
        const refreshed = await fetchOnce(key, request, policy, fetcher);
        if (refreshed.response.ok || refreshed.response.status === 404) return refreshed;
      } catch {
        // The bounded fallback below deliberately preserves the last successful value.
      }
      return { response: cached, status: "fallback", fetchedAt: metadata.fetchedAt };
    }

    await storage.delete(key);
    return fetchOnce(key, request, policy, fetcher);
  };
}
