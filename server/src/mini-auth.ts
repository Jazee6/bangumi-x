import type { BetterAuthPlugin } from "better-auth";
import { APIError, createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { touchMiniIdentity } from "./mini-identity-cleanup";

const WECHAT_PROVIDER_ID = "wechat-mini";
const CODE2SESSION_URL = "https://api.weixin.qq.com/sns/jscode2session";

interface MiniAuthOptions {
  database: D1Database;
  appId: string;
  appSecret: string;
}

interface Code2SessionResponse {
  errcode?: number;
  openid?: string;
  session_key?: string;
}

interface PublicUser {
  name: string;
  image?: string | null;
  isAnonymous?: boolean | null;
}

function publicIdentity(user: PublicUser) {
  if (user.isAnonymous) return { state: "unbound" as const };
  return {
    state: "bound" as const,
    profile: { name: user.name, image: user.image ?? null },
  };
}

function publicError(
  status: "BAD_REQUEST" | "UNAUTHORIZED" | "INTERNAL_SERVER_ERROR",
  code: string,
  message: string,
): APIError {
  return APIError.fromStatus(status, { code, message });
}

async function exchangeCode(options: MiniAuthOptions, code: string): Promise<string> {
  const url = new URL(CODE2SESSION_URL);
  url.searchParams.set("appid", options.appId);
  url.searchParams.set("secret", options.appSecret);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");

  let result: Code2SessionResponse;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("code2Session request failed");
    result = (await response.json()) as Code2SessionResponse;
  } catch {
    throw publicError(
      "INTERNAL_SERVER_ERROR",
      "MINI_AUTH_UNAVAILABLE",
      "Mini authentication is temporarily unavailable",
    );
  }

  if (result.errcode || !result.openid || !result.session_key) {
    throw publicError("UNAUTHORIZED", "MINI_AUTH_INVALID_CODE", "Mini login code is invalid");
  }
  return result.openid;
}

async function findUserId(database: D1Database, openId: string): Promise<string | null> {
  const row = await database
    .prepare("SELECT user_id FROM account WHERE provider_id = ? AND account_id = ?")
    .bind(WECHAT_PROVIDER_ID, openId)
    .first<{ user_id: string }>();
  return row?.user_id ?? null;
}

async function resolveUserId(database: D1Database, openId: string): Promise<string> {
  const existingUserId = await findUserId(database, openId);
  if (existingUserId) return existingUserId;

  const userId = crypto.randomUUID();
  const accountId = crypto.randomUUID();
  const now = Date.now();

  try {
    await database.batch([
      database
        .prepare(
          "INSERT INTO user (id, name, email, email_verified, is_anonymous, created_at, updated_at) VALUES (?, ?, ?, 0, 1, ?, ?)",
        )
        .bind(userId, "Anonymous", `mini-${userId}@anonymous.invalid`, now, now),
      database
        .prepare(
          "INSERT INTO account (id, account_id, provider_id, user_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(accountId, openId, WECHAT_PROVIDER_ID, userId, now, now),
      database
        .prepare("INSERT INTO mini_identity (user_id, last_active_at) VALUES (?, ?)")
        .bind(userId, now),
    ]);
    return userId;
  } catch {
    // The unique provider/account constraint selects the winner of concurrent cold starts.
    const winningUserId = await findUserId(database, openId);
    if (winningUserId) return winningUserId;
    throw publicError(
      "INTERNAL_SERVER_ERROR",
      "MINI_AUTH_UNAVAILABLE",
      "Mini authentication is temporarily unavailable",
    );
  }
}

export function miniAuth(options: MiniAuthOptions): BetterAuthPlugin {
  return {
    id: "mini-auth",
    endpoints: {
      getMiniSession: createAuthEndpoint(
        "/mini/session",
        { method: "GET", use: [sessionMiddleware] },
        async (ctx) => {
          const session = ctx.context.session.session as typeof ctx.context.session.session & {
            channel?: string;
          };
          if (session.channel !== "mini") {
            throw publicError("UNAUTHORIZED", "MINI_AUTH_INVALID_SESSION", "Mini session is invalid");
          }
          await touchMiniIdentity(options.database, session.userId);
          return ctx.json(publicIdentity(ctx.context.session.user));
        },
      ),
      signInMini: createAuthEndpoint(
        "/mini/wechat",
        { method: "POST", requireRequest: true },
        async (ctx) => {
          let body: unknown;
          try {
            body = await ctx.request.json();
          } catch {
            throw publicError("BAD_REQUEST", "MINI_AUTH_INVALID_REQUEST", "A login code is required");
          }
          if (
            typeof body !== "object" ||
            body === null ||
            !("code" in body) ||
            typeof body.code !== "string" ||
            body.code.length === 0 ||
            body.code.length > 256
          ) {
            throw publicError("BAD_REQUEST", "MINI_AUTH_INVALID_REQUEST", "A login code is required");
          }

          const openId = await exchangeCode(options, body.code);
          let userId = await resolveUserId(options.database, openId);
          let user = await ctx.context.internalAdapter.findUserById(userId);
          if (!user) {
            // Cleanup may have won immediately before this login touched the identity.
            userId = await resolveUserId(options.database, openId);
            user = await ctx.context.internalAdapter.findUserById(userId);
          }
          if (!user) throw publicError("INTERNAL_SERVER_ERROR", "MINI_AUTH_UNAVAILABLE", "Mini authentication is temporarily unavailable");

          await touchMiniIdentity(options.database, user.id);
          let session = await ctx.context.internalAdapter.createSession(user.id, false, { channel: "mini" }, true);
          const stillOwned = await findUserId(options.database, openId);
          if (stillOwned !== user.id) {
            if (session) {
              await options.database.prepare("DELETE FROM session WHERE id = ?").bind(session.id).run();
            }
            userId = await resolveUserId(options.database, openId);
            user = await ctx.context.internalAdapter.findUserById(userId);
            if (user) {
              await touchMiniIdentity(options.database, user.id);
              session = await ctx.context.internalAdapter.createSession(user.id, false, { channel: "mini" }, true);
            }
          }
          if (!user || !session) throw publicError("INTERNAL_SERVER_ERROR", "MINI_AUTH_UNAVAILABLE", "Mini authentication is temporarily unavailable");

          await setSessionCookie(ctx, { session, user });
          return ctx.json(publicIdentity(user));
        },
      ),
    },
  } satisfies BetterAuthPlugin;
}
