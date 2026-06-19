import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import { VitePWA } from "vite-plugin-pwa";
import type { Plugin } from "vite";
import { resolve } from "node:path";

// Vite 8 多环境构建下，vite-plugin-pwa 的 closeBundle 在 SSR 环境中
// 因 build.ssr=true 跳过 SW 生成；且即使触发生成，outDir 指向 dist/ 而非 dist/client/。
// 此插件在构建完成后直接调用 Workbox generateSW，输出到 dist/client/。
function pwaGenerateSW(): Plugin {
	return {
		name: "pwa-generate-sw",
		apply: "build",
		enforce: "post",
		closeBundle: {
			sequential: true,
			async handler() {
				const { generateSW } = await import("workbox-build");
				const clientDir = resolve(process.cwd(), "dist/client");
				await generateSW({
					globDirectory: clientDir,
					globPatterns: [
						"**/*.{js,css,html,ico,png,svg,webmanifest}",
					],
					swDest: resolve(clientDir, "sw.js"),
					navigateFallback: "/index.html",
					skipWaiting: true,
					clientsClaim: true,
				});
			},
		},
	};
}

const pwaOptions = {
	registerType: "autoUpdate",
	manifest: {
		name: "Bangumi X",
		short_name: "Bangumi X",
		description: "番组计划信息站",
		display: "standalone",
		theme_color: "#171717",
		background_color: "#171717",
		start_url: "/",
		icons: [
			{
				src: "/icon-192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
		],
	},
	workbox: {
		navigateFallback: "/index.html",
		globPatterns: ["**/*.{js,css,html,ico,png,svg,webmanifest}"],
	},
} as const;

const config = defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		devtools(),
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		tanstackStart(),
		viteReact(),
		babel({ presets: [reactCompilerPreset()] }),
		VitePWA(pwaOptions),
		pwaGenerateSW(),
	],
});

export default config;
