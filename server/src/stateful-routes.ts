import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { v7 as uuidv7 } from "uuid";

import {
  COLLECTION_LIST_NAME_MAX_LENGTH,
  isValidCollectionListName,
  SEARCH_KEYWORD_MAX_LENGTH,
  COLLECTION_PAGE_SIZE,
  PROGRESS_STAGE_VALUES,
  isAllowedAuthReturnPath,
  type ApiErrorResponse,
  type CollectionItem,
  type CollectionList,
  type CollectionPage,
  type PersonalRecordCounts,
  type PersonalSubjectState,
  type ProgressItem,
  type ProgressPage,
  type ProgressStage,
  type PublicCollectionListItem,
  type PublicCollectionListPage,
  type SubjectProgress,
  type SubjectType,
} from "share";

import { ApiError } from "./api-error";
import { getBangumiSubjectUrl } from "./bangumi-api";
import {
  createBroadcastSnapshotLoader,
  isBroadcastSnapshotStale,
  toSubjectBroadcast,
  type BroadcastRepository,
  type BroadcastSnapshotRecord,
} from "./broadcast";
import { getProxiedImageUrl } from "./poster";
import { normalizeSubjectSnapshot } from "./subject-snapshot";
import type { UpstreamClient, UpstreamLoadOptions, UpstreamPriority } from "./upstream-client";
import { isRecord, parsePositiveInteger } from "./validation";

import type { AuthBoundary } from "./auth";
import type { Bindings } from "./bindings";
import { BANGUMI_USER_AGENT } from "./constants";
import type {
  CollectionRepository,
  StoredCollectionItem,
  StoredCollectionList,
  StoredProgressItem,
  SubjectSnapshotRecord,
} from "./collections";
import type { AnonymousRuntime } from "./anonymous-routes";

const PRIVATE_CACHE_CONTROL = "private, no-store";
const SNAPSHOT_STALE_AFTER_MS = 24 * 60 * 60 * 1000;
/** Deferred refreshes per request stay well inside the Free plan subrequest limit. */
const MAX_DEFERRED_REFRESHES = 4;
const PERSONAL_SUBJECT_TYPES: Record<string, SubjectType> = {
  book: "书籍",
  anime: "动画",
  music: "音乐",
  game: "游戏",
  real: "三次元",
};
const PRIVATE_ROUTE_PATTERNS = ["/auth/*", "/api/auth/*", "/me/*"] as const;

export interface StatefulRuntime extends AnonymousRuntime {
  auth: AuthBoundary;
  collections: (bindings: Bindings) => CollectionRepository;
  upstream: UpstreamClient;
}

function apiError(
  status: 400 | 401 | 403 | 404 | 409 | 502 | 503,
  code: ApiErrorResponse["code"],
  message: string,
): never {
  throw new ApiError(status, { code, message });
}

function isAllowedReturnTarget(value: unknown, webOrigin: string) {
  if (typeof value !== "string") return false;
  try {
    const target = new URL(value, webOrigin);
    return target.origin === webOrigin && isAllowedAuthReturnPath(target.pathname);
  } catch {
    return false;
  }
}

async function validateSignInTarget(request: Request, webOrigin: string) {
  if (request.method !== "POST" || !request.url.endsWith("/sign-in/social")) return request;
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return request;
  }
  if (
    !isRecord(body) ||
    !isAllowedReturnTarget(body.callbackURL, webOrigin) ||
    (body.errorCallbackURL !== undefined &&
      !isAllowedReturnTarget(body.errorCallbackURL, webOrigin))
  ) {
    apiError(400, "INVALID_RETURN_TARGET", "登录返回地址无效。");
  }
  return request;
}

function parseExcludeNsfw(url: URL) {
  const value = url.searchParams.get("excludeNsfw");
  if (value === null) return false;
  if (value !== "true") {
    apiError(400, "INVALID_COLLECTION_QUERY", "内容范围查询参数无效。");
  }
  return true;
}

function parsePersonalQuery(request: Request, allowList: boolean) {
  const url = new URL(request.url);
  const pageValue = url.searchParams.get("page");
  const pageSizeValue = url.searchParams.get("pageSize");
  const page = pageValue === null ? 1 : parsePositiveInteger(pageValue);
  const pageSize =
    pageSizeValue === null ? COLLECTION_PAGE_SIZE : parsePositiveInteger(pageSizeValue);
  const typeValue = url.searchParams.get("type");
  const type = typeValue === null ? undefined : PERSONAL_SUBJECT_TYPES[typeValue];
  const keywordValue = url.searchParams.get("keyword");
  const keyword = keywordValue?.trim();
  const listValue = url.searchParams.get("list");
  if (
    !page ||
    pageSize !== COLLECTION_PAGE_SIZE ||
    (typeValue !== null && !type) ||
    (keywordValue !== null && (!keyword || keyword.length > SEARCH_KEYWORD_MAX_LENGTH)) ||
    (!allowList && listValue !== null) ||
    (allowList && listValue !== null && (listValue.length === 0 || listValue.length > 64))
  ) {
    apiError(400, "INVALID_COLLECTION_QUERY", "个人记录查询参数无效。");
  }
  return {
    page,
    filters: {
      ...(type ? { type } : {}),
      ...(keyword ? { keyword } : {}),
      ...(allowList && listValue ? { list: listValue } : {}),
      ...(parseExcludeNsfw(url) ? { excludeNsfw: true } : {}),
    },
  };
}

function parseProgressQuery(request: Request) {
  const url = new URL(request.url);
  const pageValue = url.searchParams.get("page");
  const pageSizeValue = url.searchParams.get("pageSize");
  const page = pageValue === null ? 1 : parsePositiveInteger(pageValue);
  const pageSize =
    pageSizeValue === null ? COLLECTION_PAGE_SIZE : parsePositiveInteger(pageSizeValue);
  const typeValue = url.searchParams.get("type");
  const type = typeValue === null ? undefined : PERSONAL_SUBJECT_TYPES[typeValue];
  const stageValue = url.searchParams.get("stage");
  const stage =
    stageValue === null
      ? undefined
      : PROGRESS_STAGE_VALUES.includes(stageValue as ProgressStage)
        ? (stageValue as ProgressStage)
        : undefined;
  const keywordValue = url.searchParams.get("keyword");
  const keyword = keywordValue?.trim();
  if (
    !page ||
    pageSize !== COLLECTION_PAGE_SIZE ||
    (typeValue !== null && !type) ||
    (stageValue !== null && !stage) ||
    (keywordValue !== null && (!keyword || keyword.length > SEARCH_KEYWORD_MAX_LENGTH))
  ) {
    apiError(400, "INVALID_PROGRESS_QUERY", "进度查询参数无效。");
  }
  return {
    page,
    filters: {
      ...(type ? { type } : {}),
      ...(stage ? { stage } : {}),
      ...(keyword ? { keyword } : {}),
      ...(parseExcludeNsfw(url) ? { excludeNsfw: true } : {}),
    },
  };
}

async function requireCollectionListName(request: Request): Promise<string> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    apiError(400, "INVALID_COLLECTION_LIST", "收藏列表名称无效。");
  }
  const name = isRecord(body) && typeof body.name === "string" ? body.name.trim() : "";
  if (!isValidCollectionListName(name)) {
    apiError(
      400,
      "INVALID_COLLECTION_LIST",
      `收藏列表名称需为 1 至 ${COLLECTION_LIST_NAME_MAX_LENGTH} 个字符。`,
    );
  }
  return name;
}

function requireSubjectId(value: string) {
  const subjectId = parsePositiveInteger(value);
  if (!subjectId) apiError(400, "INVALID_SUBJECT_ID", "条目 ID 无效。");
  return subjectId;
}

function subjectSnapshotItem(record: SubjectSnapshotRecord, origin: string) {
  return {
    id: record.subjectId,
    title: record.title,
    type: record.type,
    imageUrl: getProxiedImageUrl(record.posterSourceUrl, origin),
    nsfw: record.nsfw,
  };
}

function collectionItem(record: StoredCollectionItem, origin: string): CollectionItem {
  return {
    ...subjectSnapshotItem(record, origin),
    collectedAt: record.collectedAt.toISOString(),
    progress: record.progress,
  };
}

function collectionListItem(record: StoredCollectionList): CollectionList {
  return {
    id: record.id,
    name: record.name,
    isPublic: record.isPublic,
    shareId: record.shareToken,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    ...(record.count === undefined ? {} : { count: record.count }),
  };
}

function publicCollectionListItem(
  record: SubjectSnapshotRecord,
  origin: string,
): PublicCollectionListItem {
  return subjectSnapshotItem(record, origin);
}

function progressItem(
  record: StoredProgressItem,
  origin: string,
  broadcast: BroadcastSnapshotRecord | null,
  now: Date,
): ProgressItem {
  return {
    ...subjectSnapshotItem(record, origin),
    stage: record.stage,
    completedChapters: record.completedChapters,
    totalChapters: record.totalChapters,
    progressUpdatedAt: record.progressUpdatedAt.toISOString(),
    collected: record.collectedAt !== null,
    broadcast:
      record.type === "动画" || record.type === "三次元"
        ? toSubjectBroadcast(broadcast, now)
        : null,
  };
}

async function requireUser(
  context: {
    req: { raw: Request };
    env: Bindings;
  },
  auth: AuthBoundary,
) {
  const session = await auth.getSession(context.req.raw, context.env);
  if (!session) apiError(401, "UNAUTHORIZED", "请先登录。");
  return session.user;
}

function requireWriteOrigin(request: Request, webOrigin: string) {
  if (request.headers.get("Origin") !== webOrigin) {
    apiError(403, "INVALID_ORIGIN", "请求来源无效。");
  }
}

async function requireWriteUser(
  context: {
    req: { raw: Request };
    env: Bindings;
  },
  auth: AuthBoundary,
) {
  const authorization = context.req.raw.headers.get("Authorization");
  if (authorization && /^Bearer\s+\S+$/i.test(authorization)) {
    const bearerRequest = new Request(context.req.raw.url, {
      headers: { Authorization: authorization },
    });
    const bearerSession = await auth.getSession(bearerRequest, context.env);
    if (bearerSession) return bearerSession.user;
  }

  requireWriteOrigin(context.req.raw, context.env.WEB_ORIGIN);
  return requireUser(context, auth);
}

async function loadSnapshot(
  subjectId: number,
  bindings: Bindings,
  upstream: UpstreamClient,
  options: Omit<UpstreamLoadOptions, "policy">,
): Promise<SubjectSnapshotRecord> {
  let loaded;
  try {
    loaded = await upstream.load(
      new Request(getBangumiSubjectUrl(subjectId, bindings.BGM_API_URL), {
        headers: { "User-Agent": BANGUMI_USER_AGENT },
      }),
      options,
    );
  } catch {
    apiError(502, "COLLECTION_SNAPSHOT_UNAVAILABLE", "条目资料暂时无法验证，请稍后重试。");
  }
  if (!loaded.response.ok) {
    apiError(502, "COLLECTION_SNAPSHOT_UNAVAILABLE", "条目资料暂时无法验证，请稍后重试。");
  }
  try {
    const snapshot = normalizeSubjectSnapshot(await loaded.response.json());
    if (snapshot.subjectId !== subjectId) throw new TypeError("Subject ID mismatch");
    return { ...snapshot, updatedAt: loaded.fetchedAt };
  } catch {
    apiError(502, "COLLECTION_SNAPSHOT_UNAVAILABLE", "条目资料暂时无法验证，请稍后重试。");
  }
}

interface RequestContext {
  env: Bindings;
  req: { header: (name: string) => string | undefined };
  executionCtx: { waitUntil: (task: Promise<unknown>) => void };
}

function upstreamOptions(
  context: RequestContext,
  priority: UpstreamPriority,
): Omit<UpstreamLoadOptions, "policy"> {
  return {
    gated: Boolean(context.req.header("CF-Ray")),
    priority,
    waitUntil: (task) => context.executionCtx.waitUntil(task),
  };
}

function scheduleStaleSnapshotRefresh(
  context: RequestContext,
  repository: CollectionRepository,
  records: SubjectSnapshotRecord[],
  runtime: StatefulRuntime,
) {
  const cutoff = runtime.now().getTime() - SNAPSHOT_STALE_AFTER_MS;
  const staleSubjectIds = [
    ...new Set(
      records
        .filter((record) => record.updatedAt.getTime() < cutoff)
        .toSorted((left, right) => left.updatedAt.getTime() - right.updatedAt.getTime())
        .map((record) => record.subjectId),
    ),
  ].slice(0, MAX_DEFERRED_REFRESHES);
  if (staleSubjectIds.length === 0) return undefined;

  const task = Promise.allSettled(
    staleSubjectIds.map(async (subjectId) => {
      const snapshot = await loadSnapshot(
        subjectId,
        context.env,
        runtime.upstream,
        upstreamOptions(context, "background"),
      );
      await repository.refreshSnapshot(snapshot);
    }),
  ).then(() => undefined);
  context.executionCtx.waitUntil(task);
  return task;
}

function scheduleBroadcastRefresh(
  context: RequestContext,
  repository: BroadcastRepository,
  loadBroadcastSnapshot: ReturnType<typeof createBroadcastSnapshotLoader>,
  records: StoredProgressItem[],
  snapshots: Map<number, BroadcastSnapshotRecord>,
  runtime: StatefulRuntime,
  after?: Promise<void>,
) {
  const now = runtime.now();
  const updatedAt = (record: StoredProgressItem) =>
    snapshots.get(record.subjectId)?.updatedAt.getTime() ?? 0;
  const refreshable = records
    .filter(
      (record) =>
        (record.type === "动画" || record.type === "三次元") &&
        isBroadcastSnapshotStale(snapshots.get(record.subjectId), now),
    )
    .toSorted((left, right) => updatedAt(left) - updatedAt(right))
    .slice(0, MAX_DEFERRED_REFRESHES);
  if (refreshable.length === 0) return;

  // Background loads never queue for concurrency slots, so wait for the snapshot batch first.
  const task = (async () => {
    await after;
    await Promise.allSettled(
      refreshable.map(async (record) => {
        const snapshot = await loadBroadcastSnapshot({
          subjectId: record.subjectId,
          plannedChapters: record.totalChapters,
          apiUrl: context.env.BGM_API_URL,
          now: runtime.now(),
          upstream: upstreamOptions(context, "background"),
        });
        await repository.upsert(snapshot);
      }),
    );
  })();
  context.executionCtx.waitUntil(task);
}

async function syncPublicCollectionLists(
  bindings: Bindings,
  runtime: StatefulRuntime,
  repository: CollectionRepository,
  userId: string,
  verifiedAt: Date,
) {
  const directory = runtime.directory?.(bindings);
  if (!directory) return;
  const lists = await repository.listCollectionLists(userId);
  const discoveries = lists
    .filter((list) => list.isPublic)
    .map((list) => ({
      resourceType: "collection_list" as const,
      externalId: list.shareToken,
      discoverySource: "collection_list" as const,
      indexStatus: (list.name.trim() && (list.count ?? 0) >= 3 ? "index" : "noindex") as
        | "index"
        | "noindex",
      indexReason:
        list.name.trim() && (list.count ?? 0) >= 3
          ? "public_collection_list"
          : "insufficient_items",
    }));
  await directory.recordDiscoveries(discoveries, verifiedAt);
}

async function withdrawCollectionList(
  bindings: Bindings,
  runtime: StatefulRuntime,
  shareToken: string,
  reason: "private" | "deleted",
  verifiedAt: Date,
) {
  await runtime.directory?.(bindings)?.recordDiscoveries(
    [
      {
        resourceType: "collection_list",
        externalId: shareToken,
        discoverySource: "collection_list",
        indexStatus: "noindex",
        indexReason: reason,
      },
    ],
    verifiedAt,
  );
}

async function requireVisibility(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    apiError(400, "INVALID_COLLECTION_LIST", "收藏列表可见性无效。");
  }
  if (!isRecord(body) || typeof body.isPublic !== "boolean") {
    apiError(400, "INVALID_COLLECTION_LIST", "收藏列表可见性无效。");
  }
  return body.isPublic;
}

export function createStatefulRoutes(runtime: StatefulRuntime) {
  const app = new Hono<{ Bindings: Bindings }>();
  const loadBroadcastSnapshot = createBroadcastSnapshotLoader(runtime.upstream);
  const credentialedCors = cors({
    origin: (origin, context) => (origin === context.env.WEB_ORIGIN ? origin : undefined),
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  });
  const publicCors = cors({
    origin: (origin, context) => (origin === context.env.WEB_ORIGIN ? origin : undefined),
    allowMethods: ["GET", "OPTIONS"],
  });

  for (const pattern of PRIVATE_ROUTE_PATTERNS) {
    app.use(pattern, credentialedCors);
    app.use(pattern, async (context, next) => {
      await next();
      context.header("Cache-Control", PRIVATE_CACHE_CONTROL);
    });
  }
  app.use("/public/collection-lists/*", publicCors);
  app.use("/public/collection-lists/*", async (context, next) => {
    await next();
    context.header("Cache-Control", "public, max-age=300");
  });

  app.get("/auth/status", (context) =>
    context.json({ available: runtime.auth.isAvailable(context.env) }),
  );

  app.on(["GET", "POST"], "/api/auth/*", async (context) => {
    const request = await validateSignInTarget(context.req.raw, context.env.WEB_ORIGIN);
    return runtime.auth.handler(request, context.env);
  });

  app.get("/me/collections", async (context) => {
    const user = await requireUser(context, runtime.auth);
    const { page, filters } = parsePersonalQuery(context.req.raw, true);
    const repository = runtime.collections(context.env);
    const result = await repository.listCollections(
      user.id,
      COLLECTION_PAGE_SIZE,
      (page - 1) * COLLECTION_PAGE_SIZE,
      filters,
    );
    scheduleStaleSnapshotRefresh(context, repository, result.data, runtime);
    const origin = new URL(context.req.url).origin;
    const body: CollectionPage = {
      page,
      pageSize: COLLECTION_PAGE_SIZE,
      data: result.data.map((record) => collectionItem(record, origin)),
      hasPrevious: page > 1,
      hasNext: page * COLLECTION_PAGE_SIZE < result.total,
      total: result.total,
    };
    return context.json(body);
  });

  app.get("/me/subjects/:subjectId", async (context) => {
    const user = await requireUser(context, runtime.auth);
    const subjectId = requireSubjectId(context.req.param("subjectId"));
    const repository = runtime.collections(context.env);
    const [collection, listIds, progressRecord, snapshot] = await Promise.all([
      repository.getCollection(user.id, subjectId),
      repository.getCollectionListIds(user.id, subjectId),
      repository.getProgress(user.id, subjectId),
      repository.getSnapshot(subjectId),
    ]);
    const totalChapters = collection?.totalChapters ?? snapshot?.totalChapters ?? null;
    const state: PersonalSubjectState = {
      collected: collection !== null,
      listIds,
      progress: progressRecord
        ? {
            stage: progressRecord.stage,
            completedChapters: progressRecord.completedChapters,
            totalChapters,
            updatedAt: progressRecord.updatedAt.toISOString(),
          }
        : null,
    };
    return context.json(state);
  });

  app.put("/me/collections/:subjectId", async (context) => {
    const user = await requireWriteUser(context, runtime.auth);
    const subjectId = requireSubjectId(context.req.param("subjectId"));
    let body: unknown = {};
    const contentType = context.req.header("Content-Type");
    if (contentType?.includes("application/json")) {
      try {
        body = await context.req.json();
      } catch {
        apiError(400, "INVALID_COLLECTION_LIST", "收藏列表选择无效。");
      }
    }
    const rawListIds = isRecord(body) ? (body.listIds ?? []) : null;
    if (
      !Array.isArray(rawListIds) ||
      rawListIds.some((value) => typeof value !== "string" || value.length === 0)
    ) {
      apiError(400, "INVALID_COLLECTION_LIST", "收藏列表选择无效。");
    }
    const listIds = [...new Set(rawListIds as string[])];
    const repository = runtime.collections(context.env);
    const now = runtime.now();
    const snapshot =
      (await repository.getSnapshot(subjectId)) ??
      (await loadSnapshot(
        subjectId,
        context.env,
        runtime.upstream,
        upstreamOptions(context, "foreground"),
      ));
    const saved = await repository.setCollection(user.id, snapshot, listIds, now);
    if (!saved) apiError(403, "INVALID_COLLECTION_LIST", "收藏列表选择无效。");
    await syncPublicCollectionLists(context.env, runtime, repository, user.id, now);
    return context.json({ collected: true, listIds });
  });

  app.delete("/me/collections/:subjectId", async (context) => {
    const user = await requireWriteUser(context, runtime.auth);
    const subjectId = requireSubjectId(context.req.param("subjectId"));
    const repository = runtime.collections(context.env);
    const now = runtime.now();
    await repository.removeCollection(user.id, subjectId, now);
    await syncPublicCollectionLists(context.env, runtime, repository, user.id, now);
    return context.json({ collected: false });
  });

  app.get("/me/collection-lists", async (context) => {
    const user = await requireUser(context, runtime.auth);
    const excludeNsfw = parseExcludeNsfw(new URL(context.req.url));
    const lists = await runtime
      .collections(context.env)
      .listCollectionLists(user.id, excludeNsfw ? { excludeNsfw: true } : {});
    return context.json({ data: lists.map(collectionListItem) });
  });

  app.get("/me/personal-record-counts", async (context) => {
    const user = await requireUser(context, runtime.auth);
    const excludeNsfw = parseExcludeNsfw(new URL(context.req.url));
    const counts = await runtime
      .collections(context.env)
      .getPersonalRecordCounts(user.id, excludeNsfw ? { excludeNsfw: true } : {});
    return context.json(counts satisfies PersonalRecordCounts);
  });

  app.post("/me/collection-lists", async (context) => {
    const user = await requireWriteUser(context, runtime.auth);
    const name = await requireCollectionListName(context.req.raw);
    const now = runtime.now();
    const created = await runtime.collections(context.env).createCollectionList(user.id, {
      id: uuidv7(),
      name,
      shareToken: crypto.randomUUID(),
      now,
    });
    if (!created) apiError(409, "DUPLICATE_COLLECTION_LIST", "收藏列表名称不能重复。");
    return context.json(collectionListItem(created), 201);
  });

  app.on(["PATCH", "PUT"], "/me/collection-lists/:listId", async (context) => {
    const user = await requireWriteUser(context, runtime.auth);
    const name = await requireCollectionListName(context.req.raw);
    const repository = runtime.collections(context.env);
    const now = runtime.now();
    const result = await repository.renameCollectionList(
      user.id,
      context.req.param("listId"),
      name,
      now,
    );
    if (result === "not_found") {
      apiError(404, "COLLECTION_LIST_NOT_FOUND", "收藏列表不存在。");
    }
    if (result === "duplicate") {
      apiError(409, "DUPLICATE_COLLECTION_LIST", "收藏列表名称不能重复。");
    }
    await syncPublicCollectionLists(context.env, runtime, repository, user.id, now);
    return context.json({ updated: true });
  });

  app.put("/me/collection-lists/:listId/visibility", async (context) => {
    const user = await requireWriteUser(context, runtime.auth);
    const isPublic = await requireVisibility(context.req.raw);
    const repository = runtime.collections(context.env);
    const now = runtime.now();
    const updated = await repository.setCollectionListVisibility(
      user.id,
      context.req.param("listId"),
      isPublic,
      now,
    );
    if (!updated) apiError(404, "COLLECTION_LIST_NOT_FOUND", "收藏列表不存在。");
    if (isPublic) {
      await syncPublicCollectionLists(context.env, runtime, repository, user.id, now);
    } else {
      await withdrawCollectionList(context.env, runtime, updated.shareToken, "private", now);
    }
    return context.json(collectionListItem(updated));
  });

  app.delete("/me/collection-lists/:listId/subjects/:subjectId", async (context) => {
    const user = await requireWriteUser(context, runtime.auth);
    const subjectId = requireSubjectId(context.req.param("subjectId"));
    const repository = runtime.collections(context.env);
    const now = runtime.now();
    const removed = await repository.removeCollectionListMember(
      user.id,
      context.req.param("listId"),
      subjectId,
      now,
    );
    if (!removed) apiError(404, "COLLECTION_LIST_NOT_FOUND", "收藏列表不存在。");
    await syncPublicCollectionLists(context.env, runtime, repository, user.id, now);
    return context.json({ removed: true });
  });

  app.delete("/me/collection-lists/:listId", async (context) => {
    const user = await requireWriteUser(context, runtime.auth);
    const repository = runtime.collections(context.env);
    const list = (await repository.listCollectionLists(user.id)).find(
      (candidate) => candidate.id === context.req.param("listId"),
    );
    const deleted = await repository.deleteCollectionList(user.id, context.req.param("listId"));
    if (!deleted || !list) apiError(404, "COLLECTION_LIST_NOT_FOUND", "收藏列表不存在。");
    await withdrawCollectionList(context.env, runtime, list.shareToken, "deleted", runtime.now());
    return context.json({ deleted: true });
  });

  app.get(
    "/public/collection-lists/:shareId",
    cache({
      cacheName: "public-collection-lists-v1",
      cacheControl: "public, max-age=300",
      cacheableStatusCodes: [200],
      wait: true,
    }),
    async (context) => {
      const pageValue = context.req.query("page");
      const pageSizeValue = context.req.query("pageSize");
      const page = pageValue === undefined ? 1 : parsePositiveInteger(pageValue);
      const pageSize =
        pageSizeValue === undefined ? COLLECTION_PAGE_SIZE : parsePositiveInteger(pageSizeValue);
      const shareId = context.req.param("shareId");
      const excludeNsfw = parseExcludeNsfw(new URL(context.req.url));
      if (!page || pageSize !== COLLECTION_PAGE_SIZE || shareId.length > 128) {
        apiError(400, "INVALID_COLLECTION_QUERY", "公开收藏列表查询参数无效。");
      }
      const result = await runtime
        .collections(context.env)
        .getPublicCollectionList(
          shareId,
          COLLECTION_PAGE_SIZE,
          (page - 1) * COLLECTION_PAGE_SIZE,
          excludeNsfw ? { excludeNsfw: true } : {},
        );
      if (!result) {
        apiError(404, "PUBLIC_COLLECTION_LIST_NOT_FOUND", "收藏列表不可访问。");
      }
      const now = runtime.now();
      const qualified = Boolean(result.list.name.trim()) && result.total >= 3;
      await runtime.directory?.(context.env)?.recordDiscoveries(
        [
          {
            resourceType: "collection_list",
            externalId: shareId,
            discoverySource: "collection_list",
            indexStatus: qualified ? "index" : "noindex",
            indexReason: qualified ? "public_collection_list" : "insufficient_items",
          },
          ...result.data.map((item) => ({
            resourceType: "subject" as const,
            externalId: item.subjectId.toString(),
            discoverySource: "collection_list" as const,
            indexStatus: (item.nsfw ? "noindex" : "pending") as "noindex" | "pending",
            indexReason: item.nsfw ? "nsfw" : "collection_list_item",
          })),
        ],
        now,
      );
      const origin = new URL(context.req.url).origin;
      const body: PublicCollectionListPage = {
        name: result.list.name,
        ownerName: result.ownerName,
        updatedAt: result.list.updatedAt.toISOString(),
        page,
        pageSize: COLLECTION_PAGE_SIZE,
        data: result.data.map((record) => publicCollectionListItem(record, origin)),
        hasPrevious: page > 1,
        hasNext: page * COLLECTION_PAGE_SIZE < result.total,
        total: result.total,
      };
      return context.json(body);
    },
  );

  app.get("/me/progress", async (context) => {
    const user = await requireUser(context, runtime.auth);
    const { page, filters } = parseProgressQuery(context.req.raw);
    const repository = runtime.collections(context.env);
    const result = await repository.listProgress(
      user.id,
      COLLECTION_PAGE_SIZE,
      (page - 1) * COLLECTION_PAGE_SIZE,
      filters,
    );
    const snapshotRefresh = scheduleStaleSnapshotRefresh(context, repository, result.data, runtime);
    const broadcastRepository = runtime.broadcasts?.(context.env);
    let broadcasts = new Map<number, BroadcastSnapshotRecord>();
    if (broadcastRepository) {
      try {
        const snapshots = await broadcastRepository.getMany(
          result.data.map((record) => record.subjectId),
        );
        broadcasts = new Map(snapshots.map((snapshot) => [snapshot.subjectId, snapshot]));
        scheduleBroadcastRefresh(
          context,
          broadcastRepository,
          loadBroadcastSnapshot,
          result.data,
          broadcasts,
          runtime,
          snapshotRefresh,
        );
      } catch {
        broadcasts = new Map();
      }
    }
    const origin = new URL(context.req.url).origin;
    const now = runtime.now();
    const body: ProgressPage = {
      page,
      pageSize: COLLECTION_PAGE_SIZE,
      data: result.data.map((record) =>
        progressItem(record, origin, broadcasts.get(record.subjectId) ?? null, now),
      ),
      hasPrevious: page > 1,
      hasNext: page * COLLECTION_PAGE_SIZE < result.total,
      total: result.total,
    };
    return context.json(body);
  });

  app.put("/me/progress/:subjectId", async (context) => {
    const user = await requireWriteUser(context, runtime.auth);
    const subjectId = requireSubjectId(context.req.param("subjectId"));
    let body: unknown;
    try {
      body = await context.req.json();
    } catch {
      apiError(400, "INVALID_PROGRESS", "进度数据无效。");
    }
    if (!isRecord(body)) {
      apiError(400, "INVALID_PROGRESS", "进度数据无效。");
    }

    const repository = runtime.collections(context.env);
    const now = runtime.now();
    const snapshot =
      (await repository.getSnapshot(subjectId)) ??
      (await loadSnapshot(
        subjectId,
        context.env,
        runtime.upstream,
        upstreamOptions(context, "foreground"),
      ));

    if (snapshot.type === "音乐" || snapshot.type === "其他") {
      apiError(400, "INVALID_PROGRESS", "该条目类型不支持记录进度。");
    }

    let finalStage: ProgressStage;
    let finalCompletedChapters: number | null = null;

    if (snapshot.type === "书籍" || snapshot.type === "游戏") {
      if (body.completedChapters !== undefined) {
        apiError(400, "INVALID_PROGRESS", "该条目类型不支持记录章节数。");
      }
      const rawStage = body.stage;
      if (!rawStage || !PROGRESS_STAGE_VALUES.includes(rawStage as ProgressStage)) {
        apiError(400, "INVALID_PROGRESS", "进度阶段无效。");
      }
      finalStage = rawStage as ProgressStage;
      finalCompletedChapters = null;
    } else {
      const rawChapters = body.completedChapters;
      const rawStage = body.stage;
      if (rawChapters === undefined && rawStage === undefined) {
        apiError(400, "INVALID_PROGRESS", "进度数据无效。");
      }
      if (
        rawChapters !== undefined &&
        (!Number.isSafeInteger(rawChapters) || (rawChapters as number) < 0)
      ) {
        apiError(400, "INVALID_PROGRESS", "已完成章节数必须为非负整数。");
      }
      if (rawStage !== undefined && !PROGRESS_STAGE_VALUES.includes(rawStage as ProgressStage)) {
        apiError(400, "INVALID_PROGRESS", "进度阶段无效。");
      }

      const validChapters = typeof rawChapters === "number" ? rawChapters : undefined;
      const total = snapshot.totalChapters;
      const existing = await repository.getProgress(user.id, subjectId);

      if (total !== null && total > 0) {
        // Known total synchronization
        if (validChapters !== undefined) {
          finalCompletedChapters = validChapters;
          finalStage = validChapters >= total ? "completed" : "in_progress";
        } else {
          // Only stage provided
          if (rawStage === "completed") {
            finalStage = "completed";
            finalCompletedChapters = Math.max(existing?.completedChapters ?? 0, total);
          } else {
            if ((existing?.completedChapters ?? 0) >= total) {
              apiError(400, "INVALID_PROGRESS", "请先减少已完成章节数。");
            }
            finalStage = "in_progress";
            finalCompletedChapters = existing?.completedChapters ?? 0;
          }
        }
      } else {
        // Unknown total
        if (validChapters !== undefined) {
          finalCompletedChapters = validChapters;
        } else {
          finalCompletedChapters = existing?.completedChapters ?? 0;
        }
        if (rawStage !== undefined && rawStage !== null) {
          finalStage = rawStage as ProgressStage;
        } else {
          finalStage = existing?.stage ?? "in_progress";
        }
      }
    }

    const saved = await repository.setProgress(
      user.id,
      snapshot,
      finalStage,
      finalCompletedChapters,
      now,
    );

    const result: { progress: SubjectProgress } = {
      progress: {
        stage: saved.stage,
        completedChapters: saved.completedChapters,
        totalChapters: snapshot.totalChapters,
        updatedAt: saved.updatedAt.toISOString(),
      },
    };
    return context.json(result);
  });

  app.delete("/me/progress/:subjectId", async (context) => {
    const user = await requireWriteUser(context, runtime.auth);
    const subjectId = requireSubjectId(context.req.param("subjectId"));
    await runtime.collections(context.env).clearProgress(user.id, subjectId);
    return context.json({ progress: null });
  });

  return app;
}
