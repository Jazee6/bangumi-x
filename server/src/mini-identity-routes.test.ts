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

  test("answers WeChat's signed URL verification with the exact challenge", async () => {
    const token = "callback-test-token";
    const timestamp = "1730000000";
    const nonce = "random-nonce";
    const echostr = "challenge+value&more";
    const bytes = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode([token, timestamp, nonce].sort().join("")),
    );
    const signature = Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const query = new URLSearchParams({ timestamp, nonce, signature, echostr });
    const response = await app.request(
      `/mini/wechat/content-security-callback?${query}`,
      {},
      { ...bindings, WECHAT_CALLBACK_TOKEN: token },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/plain");
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await response.text()).toBe(echostr);

    const missingChallenge = await app.request(
      `/mini/wechat/content-security-callback?${new URLSearchParams({ timestamp, nonce, signature })}`,
      {},
      { ...bindings, WECHAT_CALLBACK_TOKEN: token },
    );
    expect(missingChallenge.status).toBe(400);
  });

  test("acknowledges signed avatar review pushes in WeChat's expected format", async () => {
    const token = "callback-test-token";
    const timestamp = "1730000000";
    const nonce = "random-nonce";
    const bytes = await crypto.subtle.digest(
      "SHA-1",
      new TextEncoder().encode([token, timestamp, nonce].sort().join("")),
    );
    const signature = Array.from(new Uint8Array(bytes), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    const response = await app.request(
      `/mini/wechat/content-security-callback?${new URLSearchParams({ timestamp, nonce, signature })}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          MsgType: "event",
          Event: "wxa_media_check",
          trace_id: "review-trace",
          result: { suggest: "pass" },
        }),
      },
      { ...bindings, WECHAT_CALLBACK_TOKEN: token },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe("success");

    for (const body of ["<xml></xml>", JSON.stringify({ trace_id: "failed-check", errcode: 1 })]) {
      const failed = await app.request(
        `/mini/wechat/content-security-callback?${new URLSearchParams({ timestamp, nonce, signature })}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body },
        { ...bindings, WECHAT_CALLBACK_TOKEN: token },
      );
      expect(failed.status).toBe(200);
      expect(await failed.text()).toBe("success");
    }
  });

  test("rejects unsigned or incorrectly signed WeChat callbacks", async () => {
    const path =
      "/mini/wechat/content-security-callback?timestamp=1730000000&nonce=abc&signature=invalid&echostr=hello";
    for (const method of ["GET", "POST"]) {
      const response = await app.request(
        path,
        { method },
        { ...bindings, WECHAT_CALLBACK_TOKEN: "token" },
      );
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "INVALID_ORIGIN" });
    }
    const unconfigured = await app.request(path, {}, bindings);
    expect(unconfigured.status).toBe(403);
  });
});
