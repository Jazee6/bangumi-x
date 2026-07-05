import { Hono } from "hono";
import { cache } from "hono/cache";
import { bgmProxy, bgmUrl } from "../lib";

const app = new Hono();

app.get("/calendar", cache({ cacheName: "calendar", cacheControl: "max-age=21600" }), (_c) =>
  bgmProxy(bgmUrl("/calendar")),
);

export default app;
