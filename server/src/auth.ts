import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, genericOAuth } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";

import * as schema from "./db/schema";
import type { MiniIdentityBindings } from "./mini-identity";

import type { D1Database } from "@cloudflare/workers-types";

export const EASY_AUTH_PROVIDER_ID = "easy-auth";
const EASY_AUTH_DISCOVERY_URL = "https://account.jaze.top/.well-known/openid-configuration";

export interface AuthBindings extends MiniIdentityBindings {
  DB?: D1Database;
  WEB_ORIGIN: string;
  SERVER_URL?: string;
  BETTER_AUTH_SECRET?: string;
  EASY_AUTH_CLIENT_ID?: string;
  EASY_AUTH_CLIENT_SECRET?: string;
}

export interface AuthUser {
  id: string;
  name: string;
  image?: string | null;
  isAnonymous?: boolean | null;
}

export interface AuthSession {
  user: AuthUser;
}

export interface AuthBoundary {
  isAvailable: (bindings: AuthBindings) => boolean;
  handler: (request: Request, bindings: AuthBindings) => Promise<Response>;
  getSession: (request: Request, bindings: AuthBindings) => Promise<AuthSession | null>;
}

function requiredAuthConfig(bindings: AuthBindings) {
  if (
    !bindings.DB ||
    !bindings.SERVER_URL ||
    !bindings.BETTER_AUTH_SECRET ||
    !bindings.EASY_AUTH_CLIENT_ID ||
    !bindings.EASY_AUTH_CLIENT_SECRET
  ) {
    return null;
  }
  return {
    database: bindings.DB,
    serverUrl: bindings.SERVER_URL,
    secret: bindings.BETTER_AUTH_SECRET,
    clientId: bindings.EASY_AUTH_CLIENT_ID,
    clientSecret: bindings.EASY_AUTH_CLIENT_SECRET,
  };
}

function createBetterAuth(bindings: AuthBindings) {
  const config = requiredAuthConfig(bindings);
  if (!config) return null;

  const plugins = [
    bearer(),
    genericOAuth({
      config: [
        {
          providerId: EASY_AUTH_PROVIDER_ID,
          name: "Easy Auth",
          discoveryUrl: EASY_AUTH_DISCOVERY_URL,
          requireIdTokenVerification: true,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          scopes: ["openid", "profile", "email"],
          pkce: true,
          disableProviderLogout: true,
          overrideUserInfo: true,
          accountSubject: ({ profile }) => {
            if (typeof profile.sub !== "string" || !profile.sub) {
              throw new TypeError("Easy Auth profile is missing sub");
            }
            return profile.sub;
          },
          authentication: "basic",
        },
      ],
    }),
  ];

  return betterAuth({
    appName: "Bangumi X",
    baseURL: config.serverUrl,
    secret: config.secret,
    database: drizzleAdapter(drizzle(config.database, { schema }), {
      provider: "sqlite",
      schema,
    }),
    emailAndPassword: { enabled: false },
    session: { expiresIn: 7 * 24 * 60 * 60 },
    trustedOrigins: [bindings.WEB_ORIGIN],
    plugins,
  });
}

const authCache = new WeakMap<D1Database, NonNullable<ReturnType<typeof createBetterAuth>>>();

function getAuth(bindings: AuthBindings) {
  if (!bindings.DB) return null;
  const cached = authCache.get(bindings.DB);
  if (cached) return cached;
  const auth = createBetterAuth(bindings);
  if (auth) authCache.set(bindings.DB, auth);
  return auth;
}

export const productionAuthBoundary: AuthBoundary = {
  isAvailable: (bindings) => requiredAuthConfig(bindings) !== null,
  handler: async (request, bindings) => {
    const auth = getAuth(bindings);
    if (!auth)
      return Response.json(
        { code: "AUTH_UNAVAILABLE", message: "当前环境不支持登录。" },
        { status: 503 },
      );
    return auth.handler(request);
  },
  getSession: async (request, bindings) => {
    const auth = getAuth(bindings);
    if (!auth) return null;
    return (await auth.api.getSession({ headers: request.headers })) as AuthSession | null;
  },
};
