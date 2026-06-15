/**
 * 一次性脚本：生成 public/og-default.png（1200×630 品牌色卡）。
 * 用法：`bun run scripts/gen-og-default.ts`
 *
 * 这是构建期/手动跑的脚本，不在 Worker 里执行。直接走 satori + resvg
 * 的 default（非 wasm）入口，因为 Bun runtime 上有原生 fs 访问。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resvg, initWasm as initResvg } from "@resvg/resvg-wasm";
import satori, { init as initSatori } from "satori/standalone";

const yogaWasm = readFileSync(
	resolve("node_modules/satori/yoga.wasm"),
);
const resvgWasm = readFileSync(
	resolve("node_modules/@resvg/resvg-wasm/index_bg.wasm"),
);

// satori init 接 ArrayBuffer / Module 都行
await initSatori(new WebAssembly.Module(yogaWasm));
await initResvg(resvgWasm);

// 拉一个最小字体子集（只渲品牌字）：直接用本地 Inter
// 如果没有可用本地字体，从 Google 拉一次 Inter 子集
const TEXT = "Bangumi X · bgmx.jaze.top";
const cssRes = await fetch(
	`https://fonts.googleapis.com/css2?family=Inter:wght@700&text=${encodeURIComponent(TEXT)}`,
	{
		headers: { "User-Agent": "Mozilla/5.0" },
	},
);
const css = await cssRes.text();
const m = css.match(/src:\s*url\((https:\/\/[^)]+)\)\s*format\(['"]truetype['"]\)/);
if (!m) throw new Error("font url not found");
const fontBuf = await (await fetch(m[1])).arrayBuffer();

const svg = await satori(
	{
		type: "div",
		props: {
			style: {
				width: 1200,
				height: 630,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				backgroundColor: "#0F1115",
				color: "#F5F5F4",
				fontFamily: "Inter",
				gap: 16,
			},
			children: [
				{
					type: "div",
					props: {
						style: {
							display: "flex",
							alignItems: "center",
							gap: 16,
							fontSize: 72,
							fontWeight: 700,
						},
						children: [
							{
								type: "div",
								props: {
									style: {
										width: 24,
										height: 24,
										borderRadius: 999,
										backgroundColor: "#FF7F50",
									},
								},
							},
							"Bangumi X",
						],
					},
				},
				{
					type: "div",
					props: {
						style: {
							fontSize: 28,
							color: "#A1A1AA",
						},
						children: "bgmx.jaze.top",
					},
				},
			],
		},
	},
	{
		width: 1200,
		height: 630,
		fonts: [{ name: "Inter", data: fontBuf, weight: 700, style: "normal" }],
	},
);

const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
	.render()
	.asPng();

writeFileSync(resolve("public/og-default.png"), png);
console.log(`wrote public/og-default.png (${png.length} bytes)`);
