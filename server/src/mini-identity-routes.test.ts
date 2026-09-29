import { describe, expect, test } from "vitest";

import { createApp } from "./index";

const app = createApp();
const bindings = {
  BGM_API_URL: "https://api.example.test",
  WEB_ORIGIN: "https://web.example.test",
  SERVER_URL: "https://server.example.test",
};

describe("Mini identity HTTP boundary", () => {
  test("reports unavailable identity configuration without affecting public availability", async () => {
    const response = await app.request("/mini/auth/status", {}, bindings);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ available: false, user: null });
  });

  test("returns a retryable service error instead of creating a partial user", async () => {
    const response = await app.request(
      "/mini/auth/wechat",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "temporary-code" }),
      },
      bindings,
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      code: "MINI_AUTH_UNAVAILABLE",
      message: "当前环境不支持微信登录。",
      retryable: true,
    });
  });

  test("allows the Mini bearer header in CORS preflight", async () => {
    const response = await app.request(
      "/mini/account-links/claim",
      {
        method: "OPTIONS",
        headers: {
          Origin: bindings.WEB_ORIGIN,
          "Access-Control-Request-Method": "POST",
          "Access-Control-Request-Headers": "authorization,content-type",
        },
      },
      bindings,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  test("requires the Web origin before creating a pairing credential", async () => {
    const response = await app.request("/mini/account-links", { method: "POST" }, bindings);

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: "INVALID_ORIGIN" });
  });

  test("requires a Mini session before claiming a pairing credential", async () => {
    const response = await app.request(
      "/mini/account-links/claim",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credential: "K7M4-PQ2R" }),
      },
      bindings,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: "UNAUTHORIZED" });
  });
});
