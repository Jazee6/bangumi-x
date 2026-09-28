import { createFileRoute } from "@tanstack/react-router";

import { buildRobotsTxt } from "@/lib/crawlers";
import { CACHE_CONTROL } from "@/lib/seo";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(buildRobotsTxt(), {
          status: 200,
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": CACHE_CONTROL.directory,
          },
        });
      },
    },
  },
});
