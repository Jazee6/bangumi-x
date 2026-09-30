import type { Context, Hono } from "hono";
import { cache } from "hono/cache";
import type { ApiErrorCode } from "share";
import type { D1Database } from "@cloudflare/workers-types";

import { ApiError } from "../api-error";
import type { BroadcastRepository } from "../broadcast";
import type { CollectionRepository, SubjectSnapshotRecord } from "../collections";
import { BANGUMI_USER_AGENT } from "../constants";
import type { DirectoryDiscovery, DirectoryRepository } from "../directory";
import { isMaintenanceRequest } from "../maintenance";
import {
  createUpstreamClient,
  upstreamRateLimited,
  UpstreamUnavailableError,
  type UpstreamClient,
  type UpstreamLoadOptions,
  type UpstreamPriority,
} from "../upstream-client";
import { parsePositiveInteger } from "../validation";

export const JSON_CACHE_CONTROL = "public, max-age=3600";

export interface AnonymousBindings {
  BGM_API_URL?: string;
  WEB_ORIGIN: string;
  SERVER_URL?: string;
  DB?: D1Database;
}

export interface AnonymousRuntime {
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  now: () => Date;
  updateSubjectSnapshot?: (
    bindings: AnonymousBindings,
    snapshot: SubjectSnapshotRecord,
  ) => Promise<boolean>;
  directory?: (bindings: AnonymousBindings) => DirectoryRepository | undefined;
  collections?: (bindings: AnonymousBindings) => CollectionRepository;
  broadcasts?: (bindings: AnonymousBindings) => BroadcastRepository | undefined;
  upstream?: UpstreamClient;
}

const UPSTREAM_ERROR_MESSAGES = {
  BANGUMI_UPSTREAM_ERROR: "每日放送暂时无法加载，请稍后重试。",
  IMAGE_UPSTREAM_ERROR: "图片暂时无法加载。",
  SUBJECT_UPSTREAM_ERROR: "条目暂时无法加载，请稍后重试。",
  CHAPTER_UPSTREAM_ERROR: "章节暂时无法加载，请稍后重试。",
  PERSON_UPSTREAM_ERROR: "人物暂时无法加载，请稍后重试。",
  CHARACTER_UPSTREAM_ERROR: "角色暂时无法加载，请稍后重试。",
  DISCOVERY_UPSTREAM_ERROR: "发现内容暂时无法加载，请稍后重试。",
  RANKINGS_UPSTREAM_ERROR: "排行榜暂时无法加载，请稍后重试。",
} satisfies Partial<Record<ApiErrorCode, string>>;

type UpstreamErrorCode = keyof typeof UPSTREAM_ERROR_MESSAGES;

/**
 * Subjects reached through another resource are recorded as pending until opened directly.
 * Related persons, characters and chapters are not recorded: they vastly outnumber the entities
 * maintenance can verify, and opening them directly already records their index decision.
 */
export function relatedSubjectDiscoveries(items: readonly { id: number }[]): DirectoryDiscovery[] {
  return items.map((item) => ({
    resourceType: "subject",
    externalId: item.id.toString(),
    discoverySource: "relation",
    indexStatus: "pending",
    indexReason: "subject_unverified",
  }));
}

export function subjectIndexDecision(subject: {
  title: string;
  nsfw: boolean;
}): Pick<DirectoryDiscovery, "indexStatus" | "indexReason"> {
  if (subject.title === "未命名条目") return { indexStatus: "noindex", indexReason: "unnamed" };
  if (subject.nsfw) return { indexStatus: "noindex", indexReason: "nsfw" };
  return { indexStatus: "index", indexReason: "subject_verified" };
}

export type AnonymousApp = Hono<{ Bindings: AnonymousBindings }>;
export type AnonymousContext = Context<{ Bindings: AnonymousBindings }>;
export type AnonymousKit = ReturnType<typeof createAnonymousKit>;

export function createAnonymousKit(runtime: AnonymousRuntime) {
  const upstream = runtime.upstream ?? createUpstreamClient(runtime.fetch, runtime.now);

  function upstreamError(code: UpstreamErrorCode) {
    return new ApiError(502, { code, message: UPSTREAM_ERROR_MESSAGES[code] });
  }

  function waitUntil(context: AnonymousContext) {
    try {
      return (promise: Promise<unknown>) => context.executionCtx.waitUntil(promise);
    } catch {
      return undefined;
    }
  }

  function upstreamOptions(
    context: AnonymousContext,
    priority: UpstreamPriority = "foreground",
  ): Omit<UpstreamLoadOptions, "policy"> {
    const maintenance = isMaintenanceRequest((name) => context.req.header(name));
    return {
      gated: maintenance || Boolean(context.req.header("CF-Ray")),
      priority: maintenance ? "maintenance" : priority,
      waitUntil: waitUntil(context),
    };
  }

  interface NotFoundError {
    code: ApiErrorCode;
    message: string;
  }

  async function loadJson<T>(
    context: AnonymousContext,
    url: URL,
    errorCode: UpstreamErrorCode,
    normalize: (value: unknown) => T,
    notFound?: NotFoundError,
    init: RequestInit = {},
  ): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("User-Agent", BANGUMI_USER_AGENT);
    const request = new Request(url, { ...init, headers });
    let loaded;
    try {
      loaded = await upstream.load(request, upstreamOptions(context));
    } catch (error) {
      if (error instanceof UpstreamUnavailableError) throw upstreamError(errorCode);
      throw error;
    }
    context.header("X-Bangumi-X-Cache", loaded.status);
    const response = loaded.response;
    if (response.status === 404 && notFound) {
      throw new ApiError(404, notFound);
    }
    if (response.status === 429) throw upstreamRateLimited();
    if (!response.ok) {
      throw upstreamError(errorCode);
    }

    try {
      return normalize(await response.json());
    } catch {
      throw upstreamError(errorCode);
    }
  }

  function jsonCache(cacheName: string, cacheControl = JSON_CACHE_CONTROL) {
    const middleware = cache({
      cacheName,
      cacheControl,
      cacheableStatusCodes: [200],
      wait: true,
      keyGenerator: (context) => {
        const url = new URL(context.req.url);
        url.searchParams.sort();
        return url.toString();
      },
    });
    return async (
      context: Parameters<typeof middleware>[0],
      next: Parameters<typeof middleware>[1],
    ) => {
      if (isMaintenanceRequest((name) => context.req.header(name))) {
        return next();
      }
      return middleware(context, next);
    };
  }

  function requireId(value: string, code: ApiErrorCode, message: string): number {
    const id = parsePositiveInteger(value);
    if (!id) {
      throw new ApiError(400, { code, message });
    }
    return id;
  }

  async function recordNotFoundOn404<T>(
    promise: Promise<T>,
    bindings: AnonymousBindings,
    resourceType: DirectoryDiscovery["resourceType"],
    externalId: string,
  ): Promise<T> {
    try {
      return await promise;
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        await recordDiscoveries(
          bindings,
          [
            {
              resourceType,
              externalId,
              discoverySource: "direct_access",
              indexStatus: "noindex",
              indexReason: "not_found",
            },
          ],
          runtime.now(),
        );
      }
      throw error;
    }
  }

  async function recordDiscoveries(
    bindings: AnonymousBindings,
    items: readonly DirectoryDiscovery[],
    verifiedAt: Date,
  ) {
    if (items.length === 0) return;
    await runtime.directory?.(bindings)?.recordDiscoveries(items, verifiedAt);
  }

  return {
    runtime,
    recordDiscoveries,
    upstream,
    upstreamError,
    waitUntil,
    upstreamOptions,
    loadJson,
    jsonCache,
    requireId,
    recordNotFoundOn404,
  };
}
