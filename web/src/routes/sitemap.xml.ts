import { createFileRoute } from "@tanstack/react-router";
import { getCalendar } from "@/server/functions.ts";
import { SITE_URL } from "@/lib/seo/site.ts";

export const Route = createFileRoute("/sitemap/xml")({
  headers: () => ({
    "Content-Type": "application/xml; charset=utf-8",
    "Cache-Control": "public, max-age=3600, s-maxage=21600, stale-while-revalidate=86400",
  }),
  server: {
    handlers: {
      GET: async () => {
        const staticPaths = ["/", "/subjects", "/characters", "/persons"];
        const calendar = await getCalendar();
        const subjectPaths = calendar.flatMap((day) => day.items.map((s) => `/subjects/${s.id}`));
        const paths = [...staticPaths, ...subjectPaths];
        const now = new Date().toISOString();

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths
  .map(
    (p) =>
      `  <url><loc>${SITE_URL}${p}</loc><lastmod>${now}</lastmod>${p === "/" ? "<changefreq>daily</changefreq><priority>1.0</priority>" : "<changefreq>weekly</changefreq><priority>0.8</priority>"}</url>`,
  )
  .join("\n")}
</urlset>`;

        return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
      },
    },
  },
});
