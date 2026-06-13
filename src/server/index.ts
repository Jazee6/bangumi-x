import { Hono } from "hono";

export const app = new Hono();

// Image proxy: bypass hotlink protection from lain.bgm.tv
app.get("/api/image", async (c) => {
	const url = c.req.query("url");
	if (!url) {
		return c.text("Missing url parameter", 400);
	}

	try {
		const res = await fetch(url, {
			headers: {
				Referer: "https://bgm.tv",
				"User-Agent":
					"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
			},
		});

		if (!res.ok) {
			return c.text("Failed to fetch image", 502);
		}

		const contentType = res.headers.get("Content-Type") || "image/jpeg";
		return new Response(res.body, {
			status: 200,
			headers: {
				"Content-Type": contentType,
				"Cache-Control": "public, max-age=604800, immutable",
			},
		});
	} catch {
		return c.text("Image proxy error", 500);
	}
});
