import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { genericOAuth } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as authSchema from "./db/schema/auth";

function createAuth(env: CloudflareBindings) {
  const db = drizzle(env.DB, { schema: authSchema });

  return betterAuth({
    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: authSchema,
    }),
    plugins: [
      genericOAuth({
        config: [
          {
            providerId: "easy-auth",
            discoveryUrl: `${env.EASY_AUTH_URL}/api/auth/.well-known/openid-configuration`,
            clientId: env.EASY_AUTH_CLIENT_ID,
            clientSecret: env.EASY_AUTH_CLIENT_SECRET,
            pkce: true,
            scopes: ["openid", "profile", "email"],
            overrideUserInfo: true,
          },
        ],
      }),
    ],
    trustedOrigins: [env.SITE_URL],
    session: {
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    advanced: {
      cookiePrefix: "bx",
    },
  });
}

type Auth = ReturnType<typeof createAuth>;

const authByDatabase = new WeakMap<D1Database, Auth>();

export function getAuth(env: CloudflareBindings): Auth {
  const cached = authByDatabase.get(env.DB);
  if (cached) return cached;

  const auth = createAuth(env);
  authByDatabase.set(env.DB, auth);
  return auth;
}
