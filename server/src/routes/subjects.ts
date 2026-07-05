import { Hono } from "hono";
import { cache } from "hono/cache";
import { sValidator } from "@hono/standard-validator";
import {
  browseSubjectsSchema,
  idParamSchema,
  searchSubjectsSchema,
  subjectEpisodesSchema,
} from "@bangumi-x/share";
import { bgmProxy, bgmUrl } from "../lib";

const app = new Hono();

const subjectDetailCache = { cacheName: "subject-detail", cacheControl: "max-age=3600" };
const subjectListCache = { cacheName: "subject-list", cacheControl: "max-age=600" };

app.get("/v0/subjects/:id", cache(subjectDetailCache), sValidator("param", idParamSchema), (c) =>
  bgmProxy(bgmUrl(`/v0/subjects/${c.req.valid("param").id}`)),
);

app.get("/v0/subjects", cache(subjectListCache), sValidator("query", browseSubjectsSchema), (c) => {
  const q = c.req.valid("query");
  return bgmProxy(
    bgmUrl("/v0/subjects", {
      type: q.type,
      sort: q.sort,
      limit: q.limit,
      offset: q.offset,
    }),
  );
});

app.post("/v0/search/subjects", sValidator("json", searchSubjectsSchema), (c) => {
  const body = c.req.valid("json");
  return bgmProxy(
    bgmUrl("/v0/search/subjects", {
      limit: body.limit,
      offset: body.offset,
    }),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        keyword: body.keyword,
        sort: body.sort,
        filter: body.filter,
      }),
    },
  );
});

app.get(
  "/v0/episodes",
  cache(subjectListCache),
  sValidator("query", subjectEpisodesSchema),
  (c) => {
    const q = c.req.valid("query");
    return bgmProxy(
      bgmUrl("/v0/episodes", {
        subject_id: q.subject_id,
        type: q.type,
        limit: q.limit,
        offset: q.offset,
      }),
    );
  },
);

app.get(
  "/v0/subjects/:id/characters",
  cache(subjectListCache),
  sValidator("param", idParamSchema),
  (c) => bgmProxy(bgmUrl(`/v0/subjects/${c.req.valid("param").id}/characters`)),
);

app.get(
  "/v0/subjects/:id/persons",
  cache(subjectListCache),
  sValidator("param", idParamSchema),
  (c) => bgmProxy(bgmUrl(`/v0/subjects/${c.req.valid("param").id}/persons`)),
);

export default app;
