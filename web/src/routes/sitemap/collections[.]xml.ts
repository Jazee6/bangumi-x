import { createFileRoute } from "@tanstack/react-router";

import { createEntitySitemapHandler } from "@/lib/directory-client";

export const Route = createFileRoute("/sitemap/collections.xml")({
  server: {
    handlers: {
      GET: createEntitySitemapHandler("collection_list", "s", "公开收藏列表站点地图"),
    },
  },
});
