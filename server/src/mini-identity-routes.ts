import { Hono } from "hono";
import { cors } from "hono/cors";

import type { R2ObjectBody } from "@cloudflare/workers-types";

import type { ApiErrorResponse, MiniIdentityStatus } from "share";

import { ApiError } from "./api-error";
import {
  MiniIdentityError,
  acknowledgeAccountLinkResult,
  cancelAccountLink,
  claimAccountLink,
  confirmAccountLink,
  consumeAccountLinkResult,
  createAccountLink,
  getAccountLinkPreview,
  getAccountLinkWebStatus,
  getAvatar,
  getMiniIdentity,
  isMiniIdentityAvailable,
  signInWithWechat,
  submitMiniAvatar,
  updateMiniDisplayName,
} from "./mini-identity";
import { isRecord } from "./validation";

import type { AuthBoundary } from "./auth";
import type { Bindings } from "./bindings";

const PRIVATE_CACHE_CONTROL = "private, no-store";

export interface MiniIdentityRuntime {
  auth: AuthBoundary;
  fetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
  now: () => Date;
}

function rethrow(error: unknown): never {
  if (error instanceof MiniIdentityError) {
    throw new ApiError(error.status, {
      code: error.code as ApiErrorResponse["code"],
      message: error.message,
      retryable: error.retryable,
    });
  }
  throw error;
}

async function optionalUserId(request: Request, bindings: Bindings, auth: AuthBoundary) {
  return (await auth.getSession(request, bindings))?.user.id ?? null;
}

async function requireUserId(request: Request, bindings: Bindings, auth: AuthBoundary) {
  const userId = await optionalUserId(request, bindings, auth);
  if (!userId) throw new ApiError(401, { code: "UNAUTHORIZED", message: "请先登录。" });
  return userId;
}

function requireWebOrigin(request: Request, origin: string) {
  if (request.headers.get("Origin") !== origin) {
    throw new ApiError(403, { code: "INVALID_ORIGIN", message: "请求来源无效。" });
  }
}

async function requireJson(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new TypeError("Expected object");
    return body;
  } catch {
    throw new ApiError(400, { code: "INVALID_MINI_PROFILE", message: "请求数据无效。" });
  }
}

async function objectResponse(object: R2ObjectBody) {
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("ETag", object.httpEtag);
  return new Response(await object.arrayBuffer(), { headers });
}

export function createMiniIdentityRoutes(runtime: MiniIdentityRuntime) {
  const app = new Hono<{ Bindings: Bindings }>();
  const webCors = cors({
    origin: (origin, context) => (origin === context.env.WEB_ORIGIN ? origin : undefined),
    allowHeaders: ["Authorization", "Content-Type"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
  });

  app.use("/mini/*", async (context, next) => {
    await next();
    if (!context.res.headers.has("Cache-Control")) {
      context.header("Cache-Control", PRIVATE_CACHE_CONTROL);
    }
  });
  app.use("/mini/account-links", webCors);
  app.use("/mini/account-links/*", webCors);

  app.get("/mini/auth/status", (context) => {
    const body: MiniIdentityStatus = {
      available: isMiniIdentityAvailable(context.env),
      user: null,
    };
    return context.json(body);
  });

  app.post("/mini/auth/wechat", async (context) => {
    const body = await requireJson(context.req.raw);
    try {
      const result = await signInWithWechat(
        context.env,
        typeof body.code === "string" ? body.code : "",
        runtime.now(),
        runtime.fetch,
      );
      return context.json(result);
    } catch (error) {
      rethrow(error);
    }
  });

  app.get("/mini/me", async (context) => {
    const userId = await requireUserId(context.req.raw, context.env, runtime.auth);
    const user = await getMiniIdentity(context.env, userId);
    if (!user) throw new ApiError(401, { code: "UNAUTHORIZED", message: "登录已失效。" });
    return context.json({ user });
  });

  app.post("/mini/me/display-name", async (context) => {
    const userId = await requireUserId(context.req.raw, context.env, runtime.auth);
    const body = await requireJson(context.req.raw);
    try {
      const user = await updateMiniDisplayName(
        context.env,
        userId,
        typeof body.name === "string" ? body.name : "",
        runtime.now(),
        runtime.fetch,
      );
      return context.json({ user });
    } catch (error) {
      rethrow(error);
    }
  });

  app.post("/mini/me/avatar", async (context) => {
    const userId = await requireUserId(context.req.raw, context.env, runtime.auth);
    let form: FormData;
    try {
      form = await context.req.raw.formData();
    } catch {
      throw new ApiError(400, { code: "INVALID_MINI_PROFILE", message: "头像文件无效。" });
    }
    const avatar = form.get("avatar");
    if (!(avatar instanceof File)) {
      throw new ApiError(400, { code: "INVALID_MINI_PROFILE", message: "请选择头像图片。" });
    }
    try {
      return context.json({
        user: await submitMiniAvatar(context.env, userId, avatar, runtime.now()),
      });
    } catch (error) {
      rethrow(error);
    }
  });

  app.post("/mini/account-links", async (context) => {
    requireWebOrigin(context.req.raw, context.env.WEB_ORIGIN);
    const targetUserId = await requireUserId(context.req.raw, context.env, runtime.auth);
    try {
      return context.json(await createAccountLink(context.env, targetUserId, runtime.now()), 201);
    } catch (error) {
      rethrow(error);
    }
  });

  app.get("/mini/account-links/web/:token", async (context) => {
    requireWebOrigin(context.req.raw, context.env.WEB_ORIGIN);
    const targetUserId = await requireUserId(context.req.raw, context.env, runtime.auth);
    try {
      return context.json(
        await getAccountLinkWebStatus(
          context.env,
          context.req.param("token"),
          targetUserId,
          runtime.now(),
        ),
      );
    } catch (error) {
      rethrow(error);
    }
  });

  app.post("/mini/account-links/claim", async (context) => {
    const sourceUserId = await requireUserId(context.req.raw, context.env, runtime.auth);
    const body = await requireJson(context.req.raw);
    try {
      return context.json(
        await claimAccountLink(
          context.env,
          sourceUserId,
          typeof body.credential === "string" ? body.credential : "",
          runtime.now(),
        ),
      );
    } catch (error) {
      rethrow(error);
    }
  });

  app.get("/mini/account-links/:claimToken", async (context) => {
    const sourceUserId = await requireUserId(context.req.raw, context.env, runtime.auth);
    try {
      return context.json(
        await getAccountLinkPreview(
          context.env,
          context.req.param("claimToken"),
          sourceUserId,
          runtime.now(),
        ),
      );
    } catch (error) {
      rethrow(error);
    }
  });

  app.post("/mini/account-links/:claimToken/confirm", async (context) => {
    const sourceUserId = await requireUserId(context.req.raw, context.env, runtime.auth);
    const body = await requireJson(context.req.raw);
    try {
      return context.json(
        await confirmAccountLink(
          context.env,
          context.req.param("claimToken"),
          sourceUserId,
          typeof body.previewVersion === "string" ? body.previewVersion : "",
          runtime.now(),
        ),
      );
    } catch (error) {
      rethrow(error);
    }
  });

  app.post("/mini/account-links/:claimToken/cancel", async (context) => {
    const sourceUserId = await requireUserId(context.req.raw, context.env, runtime.auth);
    try {
      await cancelAccountLink(
        context.env,
        context.req.param("claimToken"),
        sourceUserId,
        runtime.now(),
      );
      return context.body(null, 204);
    } catch (error) {
      rethrow(error);
    }
  });

  app.post("/mini/account-links/:claimToken/result/ack", async (context) => {
    try {
      await acknowledgeAccountLinkResult(context.env, context.req.param("claimToken"));
      return context.body(null, 204);
    } catch (error) {
      rethrow(error);
    }
  });

  app.get("/mini/account-links/:claimToken/result", async (context) => {
    try {
      return context.json(
        await consumeAccountLinkResult(context.env, context.req.param("claimToken"), runtime.now()),
      );
    } catch (error) {
      rethrow(error);
    }
  });

  // 扩展名写在参数里：Hono 会把 `:id.webp` 整体当作参数名。
  app.get("/mini/avatars/:file", async (context) => {
    const object = await getAvatar(context.env, context.req.param("file"));
    if (!object) return context.notFound();
    const response = await objectResponse(object);
    response.headers.set("Cache-Control", "public, max-age=31536000, immutable");
    return response;
  });

  return app;
}
