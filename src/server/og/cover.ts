/**
 * OG 路由内的封面 fetch：从 lain.bgm.tv（带 hotlink 防护）拿原图，
 * 转成 base64 data URI 直接塞进 satori，避免它在内部再 fetch（拿不到）。
 *
 * 走 `caches.default` 缓存 7 天的 data URI 字符串；条目封面变更频次极低。
 */
declare const caches: { default: Cache } & CacheStorage;

const COVER_CACHE_TTL = 60 * 60 * 24 * 7; // 7d
const ALLOWED_HOSTS = new Set(["lain.bgm.tv", "bgmimg.anibt.net"]);

/**
 * @returns base64 data URI 形如 `data:image/jpeg;base64,...`，失败抛错。
 */
export async function loadCoverDataUri(rawUrl: string): Promise<string> {
	const url = normalizeBgmUrl(rawUrl);
	const cache = caches.default;
	const cacheKey = new Request(
		`https://og.cache/cover/${encodeURIComponent(url)}`,
	);

	const cached = await cache.match(cacheKey);
	if (cached) {
		return await cached.text();
	}

	const res = await fetch(url, {
		headers: {
			// lain.bgm.tv 的 hotlink 防护接受 bgm.tv 来源。
			Referer: "https://bgm.tv/",
			"User-Agent":
				"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
		},
	});
	if (!res.ok) {
		throw new Error(`cover fetch ${res.status} for ${url}`);
	}
	const ct = res.headers.get("content-type") ?? "image/jpeg";
	if (!ct.startsWith("image/")) {
		throw new Error(`cover not image: ${ct}`);
	}
	const buf = await res.arrayBuffer();
	const dataUri = `data:${ct};base64,${arrayBufferToBase64(buf)}`;

	const cachedRes = new Response(dataUri, {
		headers: {
			"Content-Type": "text/plain",
			"Cache-Control": `public, max-age=${COVER_CACHE_TTL}`,
		},
	});
	await cache.put(cacheKey, cachedRes);
	return dataUri;
}

function normalizeBgmUrl(raw: string): string {
	let host: string;
	try {
		host = new URL(raw).hostname;
	} catch {
		throw new Error(`invalid cover url: ${raw}`);
	}
	if (!ALLOWED_HOSTS.has(host)) {
		throw new Error(`cover host not allowed: ${host}`);
	}
	return raw;
}

/** Workers btoa 不支持非 latin1 字节，自己用 chunked Uint8Array → binary string → btoa。 */
function arrayBufferToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = "";
	const CHUNK = 0x8000;
	for (let i = 0; i < bytes.length; i += CHUNK) {
		const chunk = bytes.subarray(i, i + CHUNK);
		binary += String.fromCharCode(...chunk);
	}
	return btoa(binary);
}
