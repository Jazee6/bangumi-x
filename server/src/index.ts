import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { getAuth } from "./auth";
import calendar from "./routes/calendar";
import characters from "./routes/characters";
import episodes from "./routes/episodes";
import image from "./routes/image";
import og from "./routes/og";
import persons from "./routes/persons";
import subjects from "./routes/subjects";
import { cleanupInactiveMiniIdentities } from "./mini-identity-cleanup";

const app = new Hono<{ Bindings: CloudflareBindings }>();

app.use(
  "*",
  cors({
    origin: (origin, c) => (origin === c.env.SITE_URL ? origin : ""),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Length", "set-auth-token"],
    maxAge: 600,
    credentials: true,
  }),
);

app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const response = await getAuth(c.env).handler(c.req.raw);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("CDN-Cache-Control", "no-store");
  return response;
});

app.route("/bgm", calendar);
app.route("/bgm", subjects);
app.route("/bgm", episodes);
app.route("/bgm", characters);
app.route("/bgm", persons);
app.route("/bgm", image);
app.route("/og", og);

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  console.error(err);
  return c.text("Internal Server Error", 500);
});

export default {
  fetch: app.fetch,
  async scheduled(_controller, env) {
    const deleted = await cleanupInactiveMiniIdentities(env.DB);
    console.info("MiniIdentity cleanup completed", { deleted });
  },
} satisfies ExportedHandler<CloudflareBindings>;
