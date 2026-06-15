import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo/site";
import { buildSitemap, type SitemapEntry } from "@/lib/seo/sitemap";

/**
 * 主要静态页面 sitemap 分片：首页 + 条目主列表。
 * 角色 / 人物列表本身 noindex（搜索结果页），故不入 sitemap。
 */
export const Route = createFileRoute("/sitemap-static.xml")({
	server: {
		handlers: {
			GET: async () => {
				const entries: SitemapEntry[] = [
					{
						loc: `${SITE_URL}/`,
						changefreq: "daily",
						priority: 1.0,
					},
					{
						loc: `${SITE_URL}/subjects`,
						changefreq: "daily",
						priority: 0.8,
					},
				];

				return new Response(buildSitemap(entries), {
					headers: {
						"Content-Type": "application/xml; charset=utf-8",
						"Cache-Control":
							"public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
					},
				});
			},
		},
	},
});
