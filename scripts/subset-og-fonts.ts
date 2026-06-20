/**
 * 生成 OG 渲染用的静态字体子集。
 *
 * 为什么：satori（opentype.js）只吃 TTF，不认 woff2；原先运行期每次按页面文本
 * 向 Google Fonts 拉子集，几乎每条目标题都命中不同字符集 → 冷缓存要多次外网往返。
 * 改成构建期一次性生成静态 TTF 放 public/og-fonts/，运行期 Worker 从自身 origin
 * 拉一次后由 caches.default 复用，彻底消除每页 Google 往返。
 *
 * 来源：@fontsource 打包的 Google 子集 woff2（Noto Sans SC 的 chinese-simplified
 * 子集已覆盖常用简体汉字+拉丁；Noto Sans JP 的 japanese 子集覆盖假名+日文汉字）。
 * subset-font（harfbuzzjs）把 woff2 转 TTF，并按给定字符集再裁剪。
 *
 * 用法：bun run subset:og-fonts
 */
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import subsetFont from "subset-font";

const OUT_DIR = resolve(process.cwd(), "public/og-fonts");

const SRC = [
	{
		family: "noto-sc",
		weights: [400, 700],
		url: (w: number) =>
			`https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-sc@5.2.5/files/noto-sans-sc-chinese-simplified-${w}-normal.woff2`,
	},
	{
		family: "noto-jp",
		weights: [400, 700],
		url: (w: number) =>
			`https://cdn.jsdelivr.net/npm/@fontsource/noto-sans-jp@5.2.5/files/noto-sans-jp-japanese-${w}-normal.woff2`,
	},
];

/**
 * 要保留的字符集。传给 subset-font 后，它只保留源字体里实际存在的字形，
 * 所以可以放心传一个超集（这里覆盖 ASCII、CJK 标点、假名、全角、CJK 统一表意文字）。
 * 源是 @fontsource 的「常用」子集，覆盖度 ≈ GB2312 量级，罕见/繁体字不覆盖（OG 可接受 tofu）。
 */
function keepChars(): string {
	const ranges: Array<[number, number]> = [
		[0x0020, 0x007e], // ASCII 可见字符
		[0x00a0, 0x00ff], // 拉丁补充（音译人名偶尔用到）
		[0x2000, 0x206f], // 通用标点（— ‘ ’ “ ” … 等）
		[0x2100, 0x214f], // 字母式符号（℃ ☆ 等）
		[0x2460, 0x24ff], // 带圈数字 ①
		[0x2500, 0x257f], // 制表符（─ │ 等）
		[0x2600, 0x26ff], // 杂项符号（★ ☆ 等）
		[0x3000, 0x303f], // CJK 标点
		[0x3040, 0x309f], // 平假名
		[0x30a0, 0x30ff], // 片假名
		[0x31f0, 0x31ff], // 片假名音扩展
		[0x4e00, 0x9fff], // CJK 统一表意文字（源里有的都保留）
		[0xff00, 0xffef], // 全角/半角形式
	];
	let out = "";
	for (const [lo, hi] of ranges) {
		for (let cp = lo; cp <= hi; cp++) out += String.fromCodePoint(cp);
	}
	return out;
}

async function fetchBuf(url: string): Promise<Buffer> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`fetch ${res.status}: ${url}`);
	return Buffer.from(await res.arrayBuffer());
}

async function main() {
	await mkdir(OUT_DIR, { recursive: true });
	const keep = keepChars();

	for (const { family, weights, url } of SRC) {
		for (const weight of weights) {
			const srcUrl = url(weight);
			process.stdout.write(`${family}-${weight}: fetch... `);
			const src = await fetchBuf(srcUrl);
			const ttf = await subsetFont(src, keep, { targetFormat: "sfnt" });
			const dest = resolve(OUT_DIR, `${family}-${weight}.ttf`);
			await writeFile(dest, ttf);
			console.log(
				`${(src.length / 1024).toFixed(0)}KB woff2 → ${(ttf.length / 1024).toFixed(0)}KB ttf`,
			);
		}
	}
	console.log(`\nOK → ${OUT_DIR}`);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
