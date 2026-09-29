import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, beforeEach, describe, expect, test } from "vitest";

import { createApp } from "./index";
import { submitMiniAvatar } from "./mini-identity";

const db = env.DB;
const bindings = { ...env, SERVER_URL: "https://server.example.test", WEB_ORIGIN: "" };
const onePixelPng = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

function crc32(bytes: Uint8Array) {
  let crc = ~0;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return ~crc >>> 0;
}

// 用未压缩的 deflate 块生成体积远大于 webp 的纯色 PNG。
function uncompressedPng(size: number) {
  const raw = new Uint8Array((size * 3 + 1) * size).fill(200);
  for (let row = 0; row < size; row += 1) raw[row * (size * 3 + 1)] = 0;
  let a = 1;
  let b = 0;
  for (const byte of raw) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  const idat = new Uint8Array([
    0x78,
    0x01,
    0x01,
    raw.length & 0xff,
    raw.length >> 8,
    ~raw.length & 0xff,
    (~raw.length >> 8) & 0xff,
    ...raw,
    b >> 8,
    b & 0xff,
    a >> 8,
    a & 0xff,
  ]);
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array([...new TextEncoder().encode(type), ...data]);
    const view = new DataView(new ArrayBuffer(4));
    const length = new Uint8Array(4);
    new DataView(length.buffer).setUint32(0, data.length);
    view.setUint32(0, crc32(body));
    return [...length, ...body, ...new Uint8Array(view.buffer)];
  };
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, size);
  headerView.setUint32(4, size);
  header.set([8, 2, 0, 0, 0], 8);
  return new Uint8Array([
    0x89,
    0x50,
    0x4e,
    0x47,
    0x0d,
    0x0a,
    0x1a,
    0x0a,
    ...chunk("IHDR", header),
    ...chunk("IDAT", idat),
    ...chunk("IEND", new Uint8Array()),
  ]);
}

async function publish(bytes: Uint8Array<ArrayBuffer>) {
  const user = await submitMiniAvatar(
    bindings,
    "avatar-user",
    new File([bytes], "avatar.png"),
    new Date("2026-09-28T12:00:00.000Z"),
  );
  const served = await createApp().request(new URL(user.image ?? "").pathname, {}, bindings);
  return { user, served, bytes: new Uint8Array(await served.arrayBuffer()) };
}

describe("Mini avatar upload", () => {
  beforeAll(async () => {
    await applyD1Migrations(db, env.TEST_MIGRATIONS);
  });

  beforeEach(async () => {
    const now = Date.now();
    await db.batch([
      db.prepare(`delete from user where id = 'avatar-user'`),
      db
        .prepare(
          `insert into user
           (id, name, email, email_verified, image, is_anonymous, created_at, updated_at)
           values ('avatar-user', '微信用户', 'avatar@example.invalid', 1, null, 1, ?, ?)`,
        )
        .bind(now, now),
      db
        .prepare(`insert into mini_profile (user_id, updated_at) values ('avatar-user', ?)`)
        .bind(now),
    ]);
  });

  test("keeps the original when it is smaller than the webp", async () => {
    const { user, served, bytes } = await publish(onePixelPng);

    expect(user.image).toMatch(
      /^https:\/\/server\.example\.test\/mini\/avatars\/[a-f0-9]{32}\.png$/,
    );
    expect(served.status).toBe(200);
    expect(served.headers.get("Content-Type")).toBe("image/png");
    expect(bytes).toEqual(onePixelPng);
  });

  test("stores the webp when it is smaller and replaces the previous avatar", async () => {
    const first = await publish(onePixelPng);
    const large = uncompressedPng(64);
    const { user, served, bytes } = await publish(large);

    expect(user.image).toMatch(/\.webp$/);
    expect(served.headers.get("Content-Type")).toBe("image/webp");
    expect(bytes.byteLength).toBeLessThan(large.byteLength);
    const profile = await db
      .prepare(`select avatar_key from mini_profile where user_id = 'avatar-user'`)
      .first<{ avatar_key: string }>();
    expect(user.image).toBe(`https://server.example.test/mini/${profile?.avatar_key}`);
    const previousPath = new URL(first.user.image ?? "").pathname;
    expect((await createApp().request(previousPath, {}, bindings)).status).toBe(404);
  });

  test("rejects avatar paths outside the stored file pattern", async () => {
    for (const path of ["/mini/avatars/abc.webp", "/mini/avatars/../candidates/x"]) {
      expect((await createApp().request(path, {}, bindings)).status).toBe(404);
    }
  });
});
