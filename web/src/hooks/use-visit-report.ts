import { useEffect } from "react";

import type { VisitResourceType } from "share";

import { serverUrl } from "@/lib/server-url";

/**
 * Reports a public entity page once it runs in a browser. Server adds entities to the public
 * directory only from such reports, so scrapers that fetch the HTML never grow the sitemap.
 */
export function useVisitReport(type: VisitResourceType, id: string) {
  useEffect(() => {
    const url = new URL("/visits", serverUrl);
    url.searchParams.set("type", type);
    url.searchParams.set("id", id);
    fetch(url, { method: "POST", keepalive: true }).catch(() => undefined);
  }, [type, id]);
}
