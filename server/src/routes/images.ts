import { cache } from "hono/cache";

import { ApiError } from "../api-error";
import { parseAllowedPosterUrl, parseImageVariant } from "../poster";
import type { AnonymousApp, AnonymousKit } from "./kit";

export function registerImageRoutes(app: AnonymousApp, kit: AnonymousKit) {
  const { runtime, upstreamError } = kit;

  async function loadImage(upstreamUrl: URL): Promise<Response> {
    let upstreamResponse: Response;
    try {
      upstreamResponse = await runtime.fetch(upstreamUrl);
    } catch {
      throw upstreamError("IMAGE_UPSTREAM_ERROR");
    }
    if (!upstreamResponse.ok) {
      throw upstreamError("IMAGE_UPSTREAM_ERROR");
    }

    const headers = new Headers();
    const contentType = upstreamResponse.headers.get("Content-Type");
    if (contentType) {
      headers.set("Content-Type", contentType);
    }
    return new Response(upstreamResponse.body, { headers });
  }

  app.get(
    "/images",
    cache({
      cacheName: "images",
      cacheControl: "public, max-age=604800",
      cacheableStatusCodes: [200],
    }),
    async (context) => {
      const upstreamUrl = parseAllowedPosterUrl(context.req.query("url"));
      const variant = parseImageVariant(context.req.query("size"));
      if (!upstreamUrl || !variant) {
        throw new ApiError(400, { code: "INVALID_IMAGE_URL", message: "图片地址无效。" });
      }
      return loadImage(upstreamUrl);
    },
  );
}
