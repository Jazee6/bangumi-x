import { Hono } from "hono";

import type { ApiErrorResponse } from "share";

import { ApiError } from "./api-error";
import { createAnonymousRoutes, type AnonymousRuntime } from "./anonymous-routes";
import { productionAuthBoundary, type AuthBoundary } from "./auth";
import { createD1BroadcastRepository } from "./broadcast";
import type { Bindings } from "./bindings";
import { createD1CollectionRepository, type CollectionRepository } from "./collections";
import { createD1DirectoryRepository } from "./directory";
import { createMiniIdentityRoutes } from "./mini-identity-routes";
import {
  MAINTENANCE_HEADER,
  REQUEST_MAINTENANCE_SAMPLE_RATE,
  runRequestMaintenance,
} from "./maintenance";
import { purgeExpiredRecords } from "./retention";
import { createStatefulRoutes } from "./stateful-routes";
import { createUpstreamClient } from "./upstream-client";

export type { Bindings } from "./bindings";

export interface RuntimeDependencies extends AnonymousRuntime {
  auth: AuthBoundary;
  collections: (bindings: Bindings) => CollectionRepository;
  random: () => number;
}

const defaultRuntime: RuntimeDependencies = {
  fetch: (input, init) => globalThis.fetch(input, init),
  now: () => new Date(),
  random: Math.random,
  auth: productionAuthBoundary,
  updateSubjectSnapshot: async (bindings, snapshot) => {
    if (!bindings.DB) return false;
    return createD1CollectionRepository(bindings.DB).refreshSnapshot(snapshot);
  },
  directory: (bindings) => (bindings.DB ? createD1DirectoryRepository(bindings.DB) : undefined),
  broadcasts: (bindings) => (bindings.DB ? createD1BroadcastRepository(bindings.DB) : undefined),
  collections: (bindings) => {
    if (!bindings.DB) throw new Error("The DB binding is not configured");
    return createD1CollectionRepository(bindings.DB);
  },
};

export function createApp(overrides: Partial<RuntimeDependencies> = {}) {
  const merged = { ...defaultRuntime, ...overrides };
  const runtime = {
    ...merged,
    upstream: merged.upstream ?? createUpstreamClient(merged.fetch, merged.now),
  };
  const app = new Hono<{ Bindings: Bindings }>();

  app.onError((error, context) => {
    if (error instanceof ApiError) {
      return context.json<ApiErrorResponse>(error.toResponse(), error.status);
    }

    console.error("Unhandled server error", error);
    return context.json<ApiErrorResponse>(
      {
        code: "INTERNAL_SERVER_ERROR",
        message: "服务暂时不可用，请稍后重试。",
        retryable: true,
      },
      500,
    );
  });

  app.notFound((context) =>
    context.json<ApiErrorResponse>(
      { code: "NOT_FOUND", message: "请求的资源不存在。", retryable: false },
      404,
    ),
  );

  app.use("*", async (context, next) => {
    await next();
    if (
      context.req.method !== "GET" ||
      !context.req.header("CF-Ray") ||
      !context.env.DB ||
      runtime.random() >= REQUEST_MAINTENANCE_SAMPLE_RATE
    ) {
      return;
    }

    const database = context.env.DB;
    const task = runRequestMaintenance({
      directory: createD1DirectoryRepository(database),
      now: runtime.now(),
      purgeExpiredRecords: () => purgeExpiredRecords(database, runtime.now()),
      request: async (path) =>
        app.request(
          path,
          { headers: { [MAINTENANCE_HEADER]: "1" } },
          context.env,
          context.executionCtx,
        ),
    }).catch(() => undefined);
    context.executionCtx.waitUntil(task);
  });

  app.route("/", createAnonymousRoutes(runtime));
  app.route("/", createStatefulRoutes(runtime));
  app.route("/", createMiniIdentityRoutes(runtime));
  return app;
}

const app = createApp();

export default app;
