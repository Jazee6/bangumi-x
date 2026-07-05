import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import calendar from "./routes/calendar";
import characters from "./routes/characters";
import episodes from "./routes/episodes";
import image from "./routes/image";
import og from "./routes/og";
import persons from "./routes/persons";
import subjects from "./routes/subjects";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: (process.env.SITE_URL ?? "https://bgmx.jaze.top").split(","),
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  }),
);

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

export default app;
