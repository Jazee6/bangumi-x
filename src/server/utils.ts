import pkg from "../../package.json";

declare const caches: { default: Cache } & CacheStorage;

const BASE_URL = process.env.BGM_API_URL ?? "https://api.bgm.tv";
const USER_AGENT = `Jazee6/bangumi-x/${pkg.version}(https://github.com/Jazee6/bangumi-x)`;

async function sha256(text: string): Promise<string> {
	const data = new TextEncoder().encode(text);
	const hash = await crypto.subtle.digest("SHA-256", data);
	return [...new Uint8Array(hash)]
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/**
 * 递归对对象 key 排序，保证相同语义的不同字段顺序生成相同的字符串。
 */
function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}
	const obj = value as Record<string, unknown>;
	const keys = Object.keys(obj).sort();
	const pairs = keys.map(
		(k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`,
	);
	return `{${pairs.join(",")}}`;
}

/**
 * 规范化 URL 作为缓存键：
 * 1. 去掉空值查询参数；
 * 2. 按 key 字母序排序；
 * 3. 保持路径和原始请求一致。
 *
 * 注意：仅用于生成缓存键，不改变实际发送到上游的请求 URL。
 */
function normalizeUrlForCache(url: string): string {
	const parsed = new URL(url);
	const entries = [...parsed.searchParams.entries()]
		.filter(([, v]) => v !== "" && v !== undefined && v !== null)
		.sort(([a], [b]) => a.localeCompare(b));

	parsed.search = "";
	for (const [k, v] of entries) {
		parsed.searchParams.set(k, v);
	}
	return parsed.toString();
}

/**
 * 上游 bangumi API 抛错时携带 HTTP 状态码，便于 loader 区分 404 / 5xx。
 *
 * Loader 拿到 BgmHttpError 后可：
 *   if (err.status === 404) throw notFound();
 */
export class BgmHttpError extends Error {
	readonly status: number;
	readonly path: string;
	constructor(status: number, statusText: string, path: string) {
		super(`Bangumi API error: ${status} ${statusText} (${path})`);
		this.name = "BgmHttpError";
		this.status = status;
		this.path = path;
	}
}

export function buildParams(
	params: Record<string, string | number | boolean | undefined>,
): URLSearchParams {
	return new URLSearchParams(
		Object.entries(params)
			.filter(([, v]) => v !== undefined)
			.map(([k, v]) => [k, String(v)]),
	);
}

export async function bgmFetch<T = unknown>(
	path: string,
	init?: RequestInit & { cacheTtl?: number },
): Promise<T> {
	const url = `${BASE_URL}${path}`;
	const cache = caches.default;
	const ttl = init?.cacheTtl;

	let cacheKey: Request | undefined;

	if (ttl) {
		if (init?.method === "POST" && init?.body) {
			const body =
				typeof init.body === "string"
					? init.body
					: await new Response(init.body).text();
			const hash = await sha256(stableStringify(JSON.parse(body)));
			const cacheUrl = new URL(normalizeUrlForCache(url));
			cacheUrl.pathname = `/__cache${cacheUrl.pathname}/${hash}`;
			cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
		} else {
			cacheKey = new Request(normalizeUrlForCache(url), init);
		}

		const cached = await cache.match(cacheKey);
		if (cached) {
			return (await cached.json()) as Promise<T>;
		}
	}

	const { cacheTtl: _, ...fetchInit } = init ?? {};
	const res = await fetch(url, {
		...fetchInit,
		headers: {
			"User-Agent": USER_AGENT,
			...fetchInit?.headers,
		},
	});

	if (!res.ok) {
		throw new BgmHttpError(res.status, res.statusText, path);
	}

	if (ttl && cacheKey) {
		const cachedRes = new Response(res.clone().body, res);
		cachedRes.headers.set("Cache-Control", `public, max-age=${ttl}`);
		await cache.put(cacheKey, cachedRes);
	}

	return (await res.json()) as Promise<T>;
}
