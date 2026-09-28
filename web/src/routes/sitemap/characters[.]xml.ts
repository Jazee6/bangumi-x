import { createFileRoute } from "@tanstack/react-router";

import { createEntitySitemapHandler } from "@/lib/directory-client";

export const Route = createFileRoute("/sitemap/characters.xml")({
  server: {
    handlers: {
      GET: createEntitySitemapHandler("character", "characters", "角色站点地图"),
    },
  },
});
