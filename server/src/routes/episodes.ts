import { Hono } from "hono";
import { cache } from "hono/cache";
import { sValidator } from "@hono/standard-validator";
import { idParamSchema } from "@bangumi-x/share";
import { bgmProxy, bgmUrl } from "../lib";

const app = new Hono();

const episodeDetailCache = { cacheName: "episode-detail", cacheControl: "max-age=3600" };

app.get("/v0/episodes/:id", cache(episodeDetailCache), sValidator("param", idParamSchema), (c) =>
  bgmProxy(bgmUrl(`/v0/episodes/${c.req.valid("param").id}`)),
);

export default app;
