import { resolve } from "node:path";
import { cloudflare } from "@cloudflare/vite-plugin";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

// 用 workbox-build injectManifest 打包自定义 SW 源（src/sw.ts）为 dist/client/sw.js，
// 并注入预缓存清单。Vite 8 多环境构建下 SSR 环境不产出 client 产物，故只在
// closeBundle 且 dist/client 存在时执行；按需重复调用幂等。
function pwaInjectSW(): Plugin {
	return {
		name: "pwa-inject-sw",
		apply: "build",
		enforce: "post",
		closeBundle: {
			sequential: true,
			async handler() {
				const { injectManifest } = await import("workbox-build");
				const clientDir = resolve(process.cwd(), "dist/client");
				await injectManifest({
					globDirectory: clientDir,
					globPatterns: [
						"**/*.{js,css,html,ico,png,svg,webmanifest,woff2,ttf}",
					],
					// 导航 fallback 由 SW 内 setCatchHandler 处理（/offline.html），
					// 这里不再用 app-shell navigateFallback（SSR 无静态 index.html）。
					globIgnores: ["**/sw.js", "**/sw.js.map", "**/workbox-*.js"],
					swSrc: resolve(process.cwd(), "src/sw.ts"),
					swDest: resolve(clientDir, "sw.js"),
					injectionPoint: "self.__WB_MANIFEST",
				});
			},
		},
	};
}

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
		pwaInjectSW(),
	],
});

export default config;
