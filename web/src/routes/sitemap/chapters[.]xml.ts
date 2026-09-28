import { createFileRoute } from "@tanstack/react-router";

import { createEntitySitemapHandler } from "@/lib/directory-client";

export const Route = createFileRoute("/sitemap/chapters.xml")({
  server: {
    handlers: {
      GET: createEntitySitemapHandler("chapter", "chapters", "章节站点地图"),
    },
  },
});
