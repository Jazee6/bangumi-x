import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_WEB_ORIGIN } from "share";

import { fetchDirectoryEntries } from "@/lib/directory-client";
import { buildUrlSet, type SitemapItem } from "@/lib/xml";
import { CACHE_CONTROL } from "@/lib/seo";

export const Route = createFileRoute("/sitemap/subjects.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const pageParam = Number(url.searchParams.get("page"));
        const page = Number.isInteger(pageParam) && pageParam >= 1 ? pageParam : 1;

        const items: SitemapItem[] = [];

        try {
          // Each subject outputs 3 canonical routes; 16,666 subjects = 49,998 URLs max
          const entries = await fetchDirectoryEntries("subject", {
            status: "index",
            page,
            pageSize: 16666,
          });
          for (const entry of entries) {
            const base = `${CANONICAL_WEB_ORIGIN}/subjects/${entry.externalId}`;
            items.push(
              { loc: base, lastmod: entry.lastVerifiedAt },
              { loc: `${base}/characters`, lastmod: entry.lastVerifiedAt },
              { loc: `${base}/persons`, lastmod: entry.lastVerifiedAt },
            );
          }
        } catch {
          return new Response("条目站点地图暂时无法生成，请稍后重试。", {
            status: 502,
            headers: {
              "Content-Type": "text/plain; charset=utf-8",
              "Cache-Control": "no-store",
            },
          });
        }

        const xml = buildUrlSet(items);
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": CACHE_CONTROL.directory,
          },
        });
      },
    },
  },
});
