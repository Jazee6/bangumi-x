import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import { proxy } from "hono/proxy";
import { z } from "zod";
import { absoluteUrl } from "@/lib/seo/site";
import { NotFoundError, renderOg } from "./og";

const ALLOWED_HOSTS = ["lain.bgm.tv", "bgmimg.anibt.net"];

const OG_TYPES = ["subject", "character", "person", "episode"] as const;
const ogParamSchema = z.object({
	type: z.enum(OG_TYPES),
	id: z.coerce.number().int().positive(),
});

const imageQuerySchema = z.object({
	url: z.url().refine((val) => {
		try {
			return ALLOWED_HOSTS.includes(new URL(val).hostname);
		} catch {
			return false;
		}
	}, "Host not allowed"),
});

export const app = new Hono();

// Image proxy: bypass hotlink protection from lain.bgm.tv
app.get(
	"/api/image",
	cache({
		cacheName: "image-proxy",
		cacheControl: "max-age=604800, immutable",
	}),
	zValidator("query", imageQuerySchema),
	async (c) => {
		const { url } = c.req.valid("query");

		return proxy(url);
	},
);

/**
 * 动态 OG 图。仅四类详情页：subject / character / person / episode。
 * URL: /api/og/:type/:id.png（id 末尾的 .png 是装饰，方便社交平台识别为图片资源）。
 * `?debug=1` 返 SVG，跳过 resvg 光栅化，便于本地调样式。
 *
 * 缓存：边缘 24h + SWR 7d；中间产物（字体子集 / 封面 base64）由 og 模块自己用
 *      `caches.default` 管 7 天。
 *
 * 失败链：上游 404 → 302 兜底图；其他渲染错误 → 同样 302 兜底，console.warn 记录。
 */
app.get("/api/og/:type/:id{[0-9]+\\.png}", async (c) => {
	const rawId = c.req.param("id").replace(/\.png$/, "");
	const parsed = ogParamSchema.safeParse({
		type: c.req.param("type"),
		id: rawId,
	});
	if (!parsed.success) {
		return c.notFound();
	}
	const { type, id } = parsed.data;

	try {
		const { png } = await renderOg({ type, id });
		return new Response(png as unknown as ArrayBuffer, {
			headers: {
				"Content-Type": "image/png",
				"Cache-Control":
					"public, s-maxage=86400, stale-while-revalidate=604800",
			},
		});
	} catch (err) {
		if (!(err instanceof NotFoundError)) {
			console.warn(`[og] render failed type=${type} id=${id}`, err);
		}
		return Response.redirect(absoluteUrl("/og-default.png"), 302);
	}
});

app.onError((err, c) => {
	if (err instanceof HTTPException) {
		return err.getResponse();
	}
	console.error(err);
	return c.text("Internal Server Error", 500);
});
