/**
 * OG 渲染字体：构建期生成的静态 TTF 子集（见 scripts/subset-og-fonts.ts），
 * 放在 public/og-fonts/，运行期 Worker 从自身 origin 拉一次后由 caches.default 复用。
 *
 * 取代原先每页按文本向 Google Fonts 拉子集的方案：那种方案几乎每条目标题都
 * 命中不同字符集 → 冷缓存多次外网往返。静态子集后，每colo 首次拉 4 个文件，
 * 之后所有 OG 渲染直接命中缓存，零外网。
 *
 * 覆盖：Noto Sans SC（常用简体汉字+拉丁）+ Noto Sans JP（假名+日文汉字），
 * 各 400/700 两个字重。罕见/繁体字不覆盖 → OG 上 tofu，可接受。
 */
declare const caches: { default: Cache } & CacheStorage;

const FONT_CACHE_TTL = 60 * 60 * 24 * 30; // 30d；文件不可变

interface FontFile {
	family: string;
	file: string;
	weight: 400 | 700;
}

// 顺序即 satori fallback 顺序：SC 在前（中文/拉丁优先），JP 兜假名；每个 family 700 在前。
const FONT_FILES: FontFile[] = [
	{ family: "Noto Sans SC", file: "noto-sc-700", weight: 700 },
	{ family: "Noto Sans SC", file: "noto-sc-400", weight: 400 },
	{ family: "Noto Sans JP", file: "noto-jp-700", weight: 700 },
	{ family: "Noto Sans JP", file: "noto-jp-400", weight: 400 },
];

export interface OgFont {
	name: string;
	data: ArrayBuffer;
	weight: 400 | 700;
	style: "normal";
}

/**
 * @param origin Worker 自身 origin，用于拼 /og-fonts/*.ttf 的绝对 URL（dev/prod 通用）。
 */
export async function loadOgFonts(origin: string): Promise<OgFont[]> {
	const cache = caches.default;

	const fonts = await Promise.all(
		FONT_FILES.map(async ({ family, file, weight }) => {
			// 合成 key：不真正请求，只作 caches.default 的稳定索引。
			const cacheKey = new Request(`https://og.cache/font/${file}`);

			let buf = await cache.match(cacheKey).then((r) => r?.arrayBuffer());
			if (!buf) {
				const res = await fetch(`${origin}/og-fonts/${file}.ttf`);
				if (!res.ok) {
					throw new Error(`og font fetch ${res.status}: ${file}`);
				}
				buf = await res.arrayBuffer();
				await cache.put(
					cacheKey,
					new Response(buf, {
						headers: {
							"Content-Type": "font/ttf",
							"Cache-Control": `public, max-age=${FONT_CACHE_TTL}`,
						},
					}),
				);
			}

			return { name: family, data: buf, weight, style: "normal" as const };
		}),
	);

	return fonts;
}
