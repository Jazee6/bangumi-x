import {
  CANONICAL_WEB_ORIGIN,
  type DirectoryItemSummary,
  type DirectoryQueryResponse,
  type DirectoryResourceType,
} from "share";

import { serverUrl } from "@/lib/server-url";
import { buildUrlSet, type SitemapItem } from "@/lib/xml";
import { CACHE_CONTROL } from "@/lib/seo";

export async function fetchDirectoryPage(
  resourceType: DirectoryResourceType,
  status: "index" | "pending" | "noindex" = "index",
  cursor?: string,
): Promise<DirectoryQueryResponse> {
  const url = new URL("/directory", serverUrl);
  url.searchParams.set("type", resourceType);
  url.searchParams.set("status", status);
  url.searchParams.set("limit", "1000");
  if (cursor) {
    url.searchParams.set("cursor", cursor);
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Directory query failed for ${resourceType} with status ${response.status}`);
  }

  return (await response.json()) as DirectoryQueryResponse;
}

export interface FetchDirectoryOptions {
  status?: "index" | "pending" | "noindex";
  maxEntries?: number;
  page?: number;
  pageSize?: number;
}

/**
 * Fetches directory entries by iteratively following `nextCursor` until reaching the page limit
 * or the 50,000 sitemap protocol threshold, preventing silent 1,000-item truncation.
 */
export async function fetchDirectoryEntries(
  resourceType: DirectoryResourceType,
  options: FetchDirectoryOptions = {},
): Promise<DirectoryItemSummary[]> {
  const status = options.status ?? "index";
  const page = options.page && options.page >= 1 ? options.page : 1;
  const pageSize = options.pageSize && options.pageSize > 0 ? options.pageSize : 50000;
  const maxEntries = options.maxEntries ?? 50000;
  const targetEnd = Math.min(page * pageSize, maxEntries);
  const targetStart = (page - 1) * pageSize;

  const entries: DirectoryItemSummary[] = [];
  let cursor: string | undefined = undefined;

  while (entries.length < targetEnd) {
    const response = await fetchDirectoryPage(resourceType, status, cursor);
    entries.push(...response.entries);
    if (!response.nextCursor || response.entries.length === 0) {
      break;
    }
    cursor = response.nextCursor;
  }

  return entries.slice(targetStart, targetEnd);
}

/**
 * Shared sitemap route handler for entity sub-sitemaps (chapters, characters, persons, collections).
 * Eliminates duplicate boilerplate across individual sub-sitemap server routes.
 */
export function createEntitySitemapHandler(
  resourceType: DirectoryResourceType,
  pathPrefix: string,
  errorDescription: string,
) {
  return async ({ request }: { request: Request }) => {
    const url = new URL(request.url);
    const pageParam = Number(url.searchParams.get("page"));
    const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

    try {
      const entries = await fetchDirectoryEntries(resourceType, {
        status: "index",
        page,
        pageSize: 50000,
      });
      const items: SitemapItem[] = entries.map((entry) => ({
        loc: `${CANONICAL_WEB_ORIGIN}/${pathPrefix}/${entry.externalId}`,
        lastmod: entry.lastVerifiedAt,
      }));
      const xml = buildUrlSet(items);
      return new Response(xml, {
        status: 200,
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Cache-Control": CACHE_CONTROL.directory,
        },
      });
    } catch {
      return new Response(`${errorDescription}暂时无法生成，请稍后重试。`, {
        status: 502,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }
  };
}
