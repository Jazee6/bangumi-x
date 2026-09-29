import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { createApp } from "./index";
import { completeAvatarReview } from "./mini-identity";

const db = env.DB;
const onePixelPng = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

describe("Mini avatar review", () => {
  beforeAll(async () => {
    await applyD1Migrations(db, env.TEST_MIGRATIONS);
  });

  test("publishes a passed candidate as the Mini user's avatar", async () => {
    const now = new Date("2026-09-28T12:00:00.000Z");
    await db
      .prepare(
        `insert into user
         (id, name, email, email_verified, image, is_anonymous, created_at, updated_at)
         values ('avatar-user', '微信用户', 'avatar@example.invalid', 1, null, 1, ?, ?)`,
      )
      .bind(now.getTime(), now.getTime())
      .run();
    await db
      .prepare(
        `insert into mini_profile
         (user_id, pending_avatar_key, pending_avatar_trace_id, pending_avatar_expires_at, updated_at)
         values ('avatar-user', 'candidates/review', 'review-trace', ?, ?)`,
      )
      .bind(now.getTime() + 60_000, now.getTime())
      .run();
    await env.AVATARS.put("candidates/review", onePixelPng, {
      httpMetadata: { contentType: "image/png" },
    });

    const bindings = { ...env, SERVER_URL: "https://server.example.test", WEB_ORIGIN: "" };
    expect(await completeAvatarReview(bindings, "review-trace", "pass", now)).toBe(true);

    const profile = await db
      .prepare(
        `select avatar_key, pending_avatar_key, pending_avatar_trace_id
         from mini_profile where user_id = 'avatar-user'`,
      )
      .first<{ avatar_key: string; pending_avatar_key: null; pending_avatar_trace_id: null }>();
    expect(profile).toMatchObject({ pending_avatar_key: null, pending_avatar_trace_id: null });
    expect(profile?.avatar_key).toMatch(/^avatars\/[a-f0-9]{32}\.webp$/);
    const user = await db
      .prepare(`select image from user where id = 'avatar-user'`)
      .first<{ image: string }>();
    expect(user?.image).toBe(`https://server.example.test/mini/${profile?.avatar_key}`);
    expect(await env.AVATARS.head(profile?.avatar_key ?? "")).not.toBeNull();
    expect(await env.AVATARS.head("candidates/review")).toBeNull();

    const served = await createApp().request(new URL(user?.image ?? "").pathname, {}, bindings);
    expect(served.status).toBe(200);
    expect(served.headers.get("Content-Type")).toBe("image/webp");
  });
});
