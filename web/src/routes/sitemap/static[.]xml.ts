import { createFileRoute } from "@tanstack/react-router";
import {
  CANONICAL_WEB_ORIGIN,
  isFutureSeason,
  RANKINGS_MIN_YEAR,
  SEASON_VALUES,
  SUBJECT_TYPE_FILTER_VALUES,
  WEEKDAY_SLUGS,
  type Season,
} from "share";

import { fetchDirectoryEntries } from "@/lib/directory-client";
import { buildUrlSet, type SitemapItem } from "@/lib/xml";
import { CACHE_CONTROL } from "@/lib/seo";

export const Route = createFileRoute("/sitemap/static.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const testNow = request.headers.get("x-test-now");
        const now = testNow ? new Date(testNow) : new Date();

        const items: SitemapItem[] = [
          { loc: `${CANONICAL_WEB_ORIGIN}/` },
          ...WEEKDAY_SLUGS.map((slug) => ({
            loc: `${CANONICAL_WEB_ORIGIN}/schedule/${slug}`,
          })),
          ...SUBJECT_TYPE_FILTER_VALUES.map((type) => ({
            loc: `${CANONICAL_WEB_ORIGIN}/discover/${type}`,
          })),
          { loc: `${CANONICAL_WEB_ORIGIN}/about` },
          { loc: `${CANONICAL_WEB_ORIGIN}/privacy` },
          { loc: `${CANONICAL_WEB_ORIGIN}/terms` },
        ];

        try {
          const entries = await fetchDirectoryEntries("ranking", {
            status: "index",
          });
          for (const entry of entries) {
            const [yearStr, seasonStr] = entry.externalId.split(/[:/]/);
            const year = Number(yearStr);
            const season = seasonStr as Season;
            if (
              Number.isFinite(year) &&
              year >= RANKINGS_MIN_YEAR &&
              SEASON_VALUES.includes(season) &&
              !isFutureSeason(year, season, now)
            ) {
              items.push({
                loc: `${CANONICAL_WEB_ORIGIN}/rankings/${year}/${season}`,
                lastmod: entry.lastVerifiedAt,
              });
            }
          }
        } catch {
          return new Response("静态与集合站点地图暂时无法生成，请稍后重试。", {
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
