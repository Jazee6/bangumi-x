import { Hono } from "hono";
import { cache } from "hono/cache";
import { sValidator } from "@hono/standard-validator";
import { imageQuerySchema } from "@bangumi-x/share";
import { proxy } from "hono/proxy";

const app = new Hono();

app.get(
  "/image",
  cache({ cacheName: "image-proxy", cacheControl: "max-age=604800, immutable" }),
  sValidator("query", imageQuerySchema),
  (c) => {
    const { url } = c.req.valid("query");
    return proxy(url);
  },
);

export default app;
