import { cache } from "hono/cache";
import {
  VISIT_RESOURCE_TYPES,
  type DirectoryIndexStatus,
  type DirectoryQueryResponse,
  type DirectoryResourceType,
  type VisitResourceType,
} from "share";

import { ApiError } from "../api-error";
import { parsePositiveInteger } from "../validation";
import { isCrawlerAgent, VISIT_HEADER, type AnonymousApp, type AnonymousKit } from "./kit";

const VISIT_COLLECTIONS: Record<VisitResourceType, string> = {
  subject: "subjects",
  chapter: "chapters",
  character: "characters",
  person: "persons",
};

export function registerDirectoryRoutes(app: AnonymousApp, kit: AnonymousKit) {
  const { runtime } = kit;

  /**
   * A browser reports a public entity page once it has run the page. The entity route then runs
   * in-process past the response cache, so its index decision is recorded as a direct access.
   */
  app.post("/visits", async (context) => {
    const type = context.req.query("type");
    const id = parsePositiveInteger(context.req.query("id") ?? "");
    if (!id || !VISIT_RESOURCE_TYPES.includes(type as VisitResourceType)) {
      throw new ApiError(400, { code: "INVALID_VISIT", message: "访问记录参数无效。" });
    }
    if (!isCrawlerAgent(context.req.header("User-Agent"))) {
      let executionCtx: typeof context.executionCtx | undefined;
      try {
        executionCtx = context.executionCtx;
      } catch {
        executionCtx = undefined;
      }
      const task = Promise.resolve(
        app.request(
          `/${VISIT_COLLECTIONS[type as VisitResourceType]}/${id}`,
          { headers: { [VISIT_HEADER]: "1" } },
          context.env,
          executionCtx,
        ),
      ).then(
        () => undefined,
        () => undefined,
      );
      if (executionCtx) executionCtx.waitUntil(task);
      else await task;
    }
    return context.body(null, 204);
  });

  app.get(
    "/directory",
    cache({
      cacheName: "directory",
      cacheControl: "public, max-age=3600, stale-while-revalidate=86400",
      cacheableStatusCodes: [200],
    }),
    async (context) => {
      const type = context.req.query("type");
      const validResourceTypes = new Set<string>([
        "subject",
        "character",
        "person",
        "collection_list",
        "ranking",
      ]);
      if (!type || !validResourceTypes.has(type)) {
        throw new ApiError(400, {
          code: "INVALID_DIRECTORY_QUERY",
          message: "目录资源类型无效。",
        });
      }
      const rawStatus = context.req.query("status") ?? "index";
      const validIndexStatuses = new Set<string>(["pending", "index", "noindex"]);
      if (!validIndexStatuses.has(rawStatus)) {
        throw new ApiError(400, {
          code: "INVALID_DIRECTORY_QUERY",
          message: "目录索引状态无效。",
        });
      }
      const resourceType = type as DirectoryResourceType;
      const indexStatus = rawStatus as DirectoryIndexStatus;
      const rawLimit = Number(context.req.query("limit") ?? 1000);
      const limit =
        Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(Math.trunc(rawLimit), 1000) : 1000;
      const cursor = context.req.query("cursor") || undefined;

      const directory = runtime.directory?.(context.env);
      if (!directory) {
        return context.json<DirectoryQueryResponse>({
          resourceType,
          entries: [],
          nextCursor: null,
        });
      }

      const page = await directory.listPage({
        resourceType,
        indexStatus,
        limit,
        cursor,
      });

      context.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");

      return context.json<DirectoryQueryResponse>({
        resourceType,
        entries: page.entries.map((entry) => ({
          externalId: entry.externalId,
          lastVerifiedAt: entry.lastVerifiedAt?.toISOString() ?? null,
          firstDiscoveredAt: entry.firstDiscoveredAt.toISOString(),
        })),
        nextCursor: page.nextCursor,
      });
    },
  );
}
