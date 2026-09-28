import { cache } from "hono/cache";
import type { DirectoryIndexStatus, DirectoryQueryResponse, DirectoryResourceType } from "share";

import { ApiError } from "../api-error";
import type { AnonymousApp, AnonymousKit } from "./kit";

export function registerDirectoryRoutes(app: AnonymousApp, kit: AnonymousKit) {
  const { runtime } = kit;

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
        "chapter",
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
