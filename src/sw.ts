/**
 * Service Worker 源文件。由 workbox-build `injectManifest` 在构建期用 esbuild
 * 打包成 dist/client/sw.js，并注入预缓存清单（self.__WB_MANIFEST）。
 *
 * 离线策略（SSR 站点）：
 *   - 导航请求 NetworkFirst：访问过的页面 SSR HTML 逐 URL 缓存，离线回放；
 *     未访问过的导航失败时由 setCatchHandler 回到预缓存的 /offline.html。
 *   - /api/image 封面代理 CacheFirst。
 *   - 同源静态资源 SWR。
 *
 * 不被 tsc 检查（tsconfig 排除），仅由 workbox esbuild 编译。
 */
/// <reference lib="webworker" />
import { clientsClaim } from "workbox-core";
import { ExpirationPlugin } from "workbox-expiration";
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute, setCatchHandler } from "workbox-routing";
import {
	CacheFirst,
	NetworkFirst,
	StaleWhileRevalidate,
} from "workbox-strategies";

const sw = self as unknown as ServiceWorkerGlobalScope;

// 构建期注入的预缓存清单（静态资源 + offline.html + manifest + 图标）。
precacheAndRoute(sw.__WB_MANIFEST);

// 导航：NetworkFirst，逐 URL 缓存 SSR HTML。
registerRoute(
	({ request }) => request.mode === "navigate",
	new NetworkFirst({
		cacheName: "pages",
		networkTimeoutSeconds: 3,
		plugins: [
			new ExpirationPlugin({
				maxEntries: 50,
				maxAgeSeconds: 7 * 24 * 60 * 60,
			}),
		],
	}),
);

// 封面代理：CacheFirst。
registerRoute(
	({ url }) => url.pathname.startsWith("/api/image"),
	new CacheFirst({
		cacheName: "images",
		plugins: [
			new ExpirationPlugin({
				maxEntries: 100,
				maxAgeSeconds: 30 * 24 * 60 * 60,
				purgeOnQuotaError: true,
			}),
		],
	}),
);

// 同源静态资源（JS/CSS/字体/图片）：SWR。
registerRoute(
	({ request, url }) =>
		url.origin === sw.location.origin &&
		["script", "style", "font", "image"].includes(request.destination),
	new StaleWhileRevalidate({ cacheName: "assets" }),
);

// 离线兜底：未访问过的页面导航失败 → 预缓存的 /offline.html。
setCatchHandler(async ({ request }) => {
	if (request.destination === "document") {
		return (await caches.match("/offline.html")) ?? Response.error();
	}
	return Response.error();
});

clientsClaim();
// 不自动 skipWaiting：等前端检测到新版本就绪、用户点「刷新」后再触发激活。
sw.addEventListener("message", (event) => {
	if ((event.data as { type?: string })?.type === "SKIP_WAITING") {
		sw.skipWaiting();
	}
});
