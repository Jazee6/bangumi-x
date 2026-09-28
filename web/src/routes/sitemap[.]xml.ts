import { createFileRoute } from "@tanstack/react-router";
import { CANONICAL_WEB_ORIGIN } from "share";

import { buildSitemapIndex } from "@/lib/xml";
import { CACHE_CONTROL } from "@/lib/seo";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const xml = buildSitemapIndex([
          { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/static.xml` },
          { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/subjects.xml` },
          { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/chapters.xml` },
          { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/characters.xml` },
          { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/persons.xml` },
          { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/collections.xml` },
        ]);

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
