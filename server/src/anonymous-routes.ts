import { Hono } from "hono";
import { cors } from "hono/cors";

import { createAnonymousKit, type AnonymousBindings, type AnonymousRuntime } from "./routes/kit";
import { registerDirectoryRoutes } from "./routes/directory";
import { registerDiscoveryRoutes } from "./routes/discovery";
import { registerEntityRoutes } from "./routes/entities";
import { registerImageRoutes } from "./routes/images";
import { registerOgRoutes } from "./routes/og";
import { registerScheduleRoutes } from "./routes/schedule";

export type { AnonymousBindings, AnonymousRuntime } from "./routes/kit";

export function createAnonymousRoutes(
  runtime: AnonymousRuntime = { fetch: globalThis.fetch, now: () => new Date() },
) {
  const app = new Hono<{ Bindings: AnonymousBindings }>();
  const kit = createAnonymousKit(runtime);

  const webCors = cors({
    origin: (origin, context) => (origin === context.env.WEB_ORIGIN ? origin : undefined),
    allowMethods: ["GET"],
  });

  app.use("/schedule", webCors);
  app.use("/og/*", webCors);
  app.use("/subjects/*", webCors);
  app.use("/chapters/*", webCors);
  app.use("/persons/*", webCors);
  app.use("/characters/*", webCors);
  app.use("/discover/*", webCors);
  app.use("/rankings", webCors);

  registerScheduleRoutes(app, kit);
  registerOgRoutes(app, kit);
  registerDiscoveryRoutes(app, kit);
  registerEntityRoutes(app, kit);
  registerDirectoryRoutes(app, kit);
  registerImageRoutes(app, kit);
  return app;
}
