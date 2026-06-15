/**
 * 给 satori 准备字体 —— Google Fonts CSS API 子集化方案。
 *
 * 流程：
 *   1. 把要渲染的字符串去重，URL-encode 成 `?text=...`。
 *   2. fetch `https://fonts.googleapis.com/css2?family=...&text=...`，
 *      用现代浏览器 UA 让 Google 返回 `woff2`（默认是 ttf）。
 *   3. CSS 内拿到一个临时的字体二进制 URL，再 fetch 拿 ArrayBuffer。
 *   4. ArrayBuffer 用 `caches.default` 缓存，cache key 含 family / weight / 字符 hash。
 *
 * 字体策略：
 *   - 默认拉 Noto Sans SC 400/700：覆盖中文、拉丁、常用日文汉字。
 *   - 文本含假名 (U+3040-30FF) 时再拉 Noto Sans JP，作 satori fonts 数组里的 fallback。
 *
 * Workers `caches.default` 只接受 http/https 的 Request 作 key，所以构造一个
 * 合成的 `https://og.cache/...` URL 当作 key，不会真的发请求。
 */
declare const caches: { default: Cache } & CacheStorage;

const FONT_CACHE_TTL = 60 * 60 * 24 * 7; // 7d
// 故意用一个老式 UA：满足 Google Fonts 但不触发 woff2 协商，
// 让接口返 TTF。satori（@shuding/opentype.js）目前不支持 woff2。
const LEGACY_UA = "Mozilla/5.0";

export interface OgFont {
	name: string;
	data: ArrayBuffer;
	weight: 400 | 700;
	style: "normal";
}

const HAS_KANA_RE = /[぀-ヿ]/;

/**
 * 主入口。返回字体数组，按优先级排列；satori 按 unicode 范围逐字 fallback。
 * 中文/拉丁优先 Noto Sans SC；命中假名时附加 JP。
 */
export async function loadOgFonts(text: string): Promise<OgFont[]> {
	const families: Array<{ family: string; name: string }> = [
		{ family: "Noto Sans SC", name: "Noto Sans SC" },
	];
	if (HAS_KANA_RE.test(text)) {
		families.push({ family: "Noto Sans JP", name: "Noto Sans JP" });
	}

	const fonts: OgFont[] = [];
	for (const { family, name } of families) {
		for (const weight of [700, 400] as const) {
			try {
				const data = await loadFontSubset(family, weight, text);
				fonts.push({ name, data, weight, style: "normal" });
			} catch (err) {
				console.warn(
					`[og.fonts] subset failed family=${family} weight=${weight}`,
					err,
				);
			}
		}
	}

	if (fonts.length === 0) {
		throw new Error("[og.fonts] no font loaded");
	}
	return fonts;
}

async function loadFontSubset(
	family: string,
	weight: number,
	text: string,
): Promise<ArrayBuffer> {
	const uniqChars = Array.from(new Set(text)).join("");
	const cacheKey = await buildCacheKey(family, weight, uniqChars);
	const cache = caches.default;

	const cached = await cache.match(cacheKey);
	if (cached) {
		return await cached.arrayBuffer();
	}

	const cssUrl =
		`https://fonts.googleapis.com/css2` +
		`?family=${encodeURIComponent(family)}:wght@${weight}` +
		`&text=${encodeURIComponent(uniqChars)}` +
		`&display=swap`;

	const cssRes = await fetch(cssUrl, { headers: { "User-Agent": LEGACY_UA } });
	if (!cssRes.ok) {
		throw new Error(`google fonts css ${cssRes.status}`);
	}
	const css = await cssRes.text();

	// 抓第一个 `src: url(...) format('truetype')` 的 URL。
	// 用 `format('truetype')` 锚定，避免 woff2 协商被意外触发时拿到 satori 不识别的格式。
	const match = css.match(
		/src:\s*url\((https:\/\/[^)]+)\)\s*format\(['"]truetype['"]\)/,
	);
	if (!match) {
		throw new Error("ttf url not found in css");
	}

	const fontRes = await fetch(match[1]);
	if (!fontRes.ok) {
		throw new Error(`ttf fetch ${fontRes.status}`);
	}
	const buf = await fontRes.arrayBuffer();

	const cachedRes = new Response(buf, {
		headers: {
			"Content-Type": "font/ttf",
			"Cache-Control": `public, max-age=${FONT_CACHE_TTL}`,
		},
	});
	await cache.put(cacheKey, cachedRes);
	return buf;
}

async function buildCacheKey(
	family: string,
	weight: number,
	chars: string,
): Promise<Request> {
	const hash = await sha256Hex(`${family}|${weight}|${chars}`);
	return new Request(
		`https://og.cache/font/${encodeURIComponent(family)}/${weight}/${hash}`,
	);
}

async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const buf = await crypto.subtle.digest("SHA-256", data);
	return Array.from(new Uint8Array(buf))
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}
