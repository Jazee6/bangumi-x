import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cache } from "hono/cache";
import { HTTPException } from "hono/http-exception";
import { proxy } from "hono/proxy";
import { z } from "zod";

const ALLOWED_HOSTS = ["lain.bgm.tv", "bgmimg.anibt.net"];

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

app.onError((err, c) => {
	if (err instanceof HTTPException) {
		return err.getResponse();
	}
	console.error(err);
	return c.text("Internal Server Error", 500);
});
