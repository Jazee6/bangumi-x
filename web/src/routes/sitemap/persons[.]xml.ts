import { createFileRoute } from "@tanstack/react-router";

import { createEntitySitemapHandler } from "@/lib/directory-client";

export const Route = createFileRoute("/sitemap/persons.xml")({
  server: {
    handlers: {
      GET: createEntitySitemapHandler("person", "persons", "人物站点地图"),
    },
  },
});
