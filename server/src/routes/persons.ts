import { Hono } from "hono";
import { cache } from "hono/cache";
import { sValidator } from "@hono/standard-validator";
import { idParamSchema, searchPersonsSchema } from "@bangumi-x/share";
import { bgmProxy, bgmUrl } from "../lib";

const app = new Hono();

const detailCache = { cacheName: "person-detail", cacheControl: "max-age=3600" };
const listCache = { cacheName: "person-list", cacheControl: "max-age=600" };

app.get("/v0/persons/:id", cache(detailCache), sValidator("param", idParamSchema), (c) =>
  bgmProxy(bgmUrl(`/v0/persons/${c.req.valid("param").id}`)),
);

app.post("/v0/search/persons", sValidator("json", searchPersonsSchema), (c) => {
  const body = c.req.valid("json");
  return bgmProxy(
    bgmUrl("/v0/search/persons", {
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

app.get("/v0/persons/:id/subjects", cache(listCache), sValidator("param", idParamSchema), (c) =>
  bgmProxy(bgmUrl(`/v0/persons/${c.req.valid("param").id}/subjects`)),
);

app.get("/v0/persons/:id/characters", cache(listCache), sValidator("param", idParamSchema), (c) =>
  bgmProxy(bgmUrl(`/v0/persons/${c.req.valid("param").id}/characters`)),
);

export default app;
