import { Hono } from "hono";
import { cache } from "hono/cache";
import { sValidator } from "@hono/standard-validator";
import { idParamSchema, searchCharactersSchema } from "@bangumi-x/share";
import { bgmProxy, bgmUrl } from "../lib";

const app = new Hono();

const detailCache = { cacheName: "character-detail", cacheControl: "max-age=3600" };
const listCache = { cacheName: "character-list", cacheControl: "max-age=600" };

app.get("/v0/characters/:id", cache(detailCache), sValidator("param", idParamSchema), (c) =>
  bgmProxy(bgmUrl(`/v0/characters/${c.req.valid("param").id}`)),
);

app.post("/v0/search/characters", sValidator("json", searchCharactersSchema), (c) => {
  const body = c.req.valid("json");
  return bgmProxy(
    bgmUrl("/v0/search/characters", {
      limit: body.limit,
      offset: body.offset,
    }),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: body.keyword,
        filter: body.filter,
      }),
    },
  );
});

app.get("/v0/characters/:id/subjects", cache(listCache), sValidator("param", idParamSchema), (c) =>
  bgmProxy(bgmUrl(`/v0/characters/${c.req.valid("param").id}/subjects`)),
);

app.get("/v0/characters/:id/persons", cache(listCache), sValidator("param", idParamSchema), (c) =>
  bgmProxy(bgmUrl(`/v0/characters/${c.req.valid("param").id}/persons`)),
);

export default app;
