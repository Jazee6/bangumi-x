import { createFileRoute } from "@tanstack/react-router";
import {
	buildSitemap,
	SITEMAP_CACHE_KEY,
	SITEMAP_CACHE_TTL,
} from "@/server/sitemap";

declare const caches: { default: Cache } & CacheStorage;

/**
 * /sitemap.xml —— 站点地图。
 *
 * 运行时实时计算拼 XML，结果整体缓存进 caches.default（6h）。
 * 命中缓存时零上游调用；未命中才现拉上游（冷缓存约 45 次子请求，适配免费档 50 上限）。
 * robots.txt 与 llms.txt 已引用本路径，无需改动。
 *
 * 缓存策略与 robots.txt 对齐：浏览器不缓存（max-age=0），边缘 6h + SWR 1d。
 */
export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const cache = caches.default;

				// 客户端可见头：浏览器不缓存（max-age=0，变更能较快传播），
				// 边缘 6h + SWR 1d（与 robots.txt 对齐）。
				const clientHeaders = {
					"Content-Type": "application/xml; charset=utf-8",
					"Cache-Control":
						"public, max-age=0, s-maxage=21600, stale-while-revalidate=86400",
				};

				// 边缘缓存命中：用客户端头重建响应（缓存的副本带 max-age=21600 仅供
				// cache.put 存活，不应直接下发给浏览器）。
				const cached = await cache.match(SITEMAP_CACHE_KEY);
				if (cached) {
					return new Response(await cached.text(), { headers: clientHeaders });
				}

				// 未命中：现拉上游拼 XML（冷缓存约 45 次子请求，适配免费档 50 上限）。
				const xml = await buildSitemap();

				// 写入边缘缓存：单独的副本带 max-age=TTL，保证 cache.put 存活 6h。
				await cache.put(
					SITEMAP_CACHE_KEY,
					new Response(xml, {
						headers: {
							"Content-Type": "application/xml; charset=utf-8",
							"Cache-Control": `public, max-age=${SITEMAP_CACHE_TTL}`,
						},
					}),
				);

				return new Response(xml, { headers: clientHeaders });
			},
		},
	},
});
