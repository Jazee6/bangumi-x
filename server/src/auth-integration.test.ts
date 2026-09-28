import { afterEach, vi, describe, expect, test } from "vitest";

import { createApp } from "./index";

import type { D1Database } from "@cloudflare/workers-types";

const originalFetch = globalThis.fetch;
const fakeDatabase = {
  prepare: () => ({
    bind: (...params: unknown[]) => ({
      all: async () => ({ results: [] }),
      raw: async () => [params],
      run: async () => ({ success: true, meta: { changes: 1 } }),
    }),
  }),
  batch: async () => [],
} as unknown as D1Database;
const bindings = {
  DB: fakeDatabase,
  WEB_ORIGIN: "http://localhost:3000",
  SERVER_URL: "http://localhost:8787",
  BETTER_AUTH_SECRET: "better-auth-test-secret-at-least-32-characters",
  EASY_AUTH_CLIENT_ID: "test-client",
  EASY_AUTH_CLIENT_SECRET: "test-client-secret",
};

const app = createApp();

function discoveryResponse() {
  return Response.json({
    issuer: "https://account.jaze.top",
    authorization_endpoint: "https://account.jaze.top/oauth/authorize",
    token_endpoint: "https://account.jaze.top/oauth/token",
    userinfo_endpoint: "https://account.jaze.top/oauth/userinfo",
    jwks_uri: "https://account.jaze.top/.well-known/jwks.json",
    id_token_signing_alg_values_supported: ["RS256"],
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("Better Auth OAuth HTTP boundary", () => {
  test("local sign-in uses the local Server callback", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn(async () => discoveryResponse()) as unknown as typeof fetch;

    const response = await app.request(
      "/api/auth/sign-in/social",
      {
        method: "POST",
        headers: {
          Origin: bindings.WEB_ORIGIN,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          provider: "easy-auth",
          callbackURL: `${bindings.WEB_ORIGIN}/collections`,
        }),
      },
      bindings,
    );
    const body = (await response.json()) as { url: string };
    const authorizationUrl = new URL(body.url);

    expect(response.status).toBe(200);
    expect(authorizationUrl.origin).toBe("https://account.jaze.top");
    expect(authorizationUrl.searchParams.get("redirect_uri")).toBe(
      "http://localhost:8787/api/auth/callback/easy-auth",
    );
    expect(authorizationUrl.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorizationUrl.searchParams.get("scope")).toBe("openid profile email");
    expect(authorizationUrl.searchParams.get("state")).toBeTruthy();
  });

  test("rejects a tampered OAuth state", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn(async () => discoveryResponse()) as unknown as typeof fetch;

    const response = await app.request(
      "/api/auth/callback/easy-auth?code=test-code&state=tampered",
      {},
      bindings,
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("Location")).toContain("/api/auth/error?error=");
  });
});
