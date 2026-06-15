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
			const hash = await sha256(body);
			const cacheUrl = new URL(url);
			cacheUrl.pathname = `/__cache${cacheUrl.pathname}/${hash}`;
			cacheKey = new Request(cacheUrl.toString(), { method: "GET" });
		} else {
			cacheKey = new Request(url, init);
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
