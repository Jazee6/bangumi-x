import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import { purgeExpiredRecords } from "./retention";

const db = env.DB;
const now = new Date("2026-10-10T12:00:00.000Z");
const hour = 60 * 60 * 1000;

async function ids(sql: string) {
  const { results } = await db.prepare(sql).all<{ id: string }>();
  return results.map((row: { id: string }) => row.id).toSorted();
}

describe("expired record retention", () => {
  beforeAll(async () => {
    await applyD1Migrations(db, env.TEST_MIGRATIONS);
  });

  test("purges records expired for more than a day and keeps the rest", async () => {
    const created = now.getTime() - 30 * 24 * hour;
    await db
      .prepare(
        `insert into user
         (id, name, email, email_verified, image, is_anonymous, created_at, updated_at)
         values ('retention-user', '保留用户', 'retention@example.invalid', 1, null, 0, ?, ?)`,
      )
      .bind(created, created)
      .run();
    const expiries = { old: now.getTime() - 25 * hour, recent: now.getTime() - 23 * hour };
    for (const [key, expiresAt] of Object.entries(expiries)) {
      await db.batch([
        db
          .prepare(
            `insert into session (id, expires_at, token, created_at, updated_at, user_id)
             values (?, ?, ?, ?, ?, 'retention-user')`,
          )
          .bind(`session-${key}`, expiresAt, `token-${key}`, created, created),
        db
          .prepare(
            `insert into verification (id, identifier, value, expires_at) values (?, ?, 'v', ?)`,
          )
          .bind(`verification-${key}`, `identifier-${key}`, expiresAt),
        db
          .prepare(
            `insert into mini_account_link_request
             (token_hash, short_code_hash, target_user_id, status, expires_at, created_at, updated_at)
             values (?, ?, 'retention-user', 'complete', ?, ?, ?)`,
          )
          .bind(`link-${key}`, `code-${key}`, expiresAt, created, created),
      ]);
    }

    await purgeExpiredRecords(db, now);

    expect(await ids("select id from session where user_id = 'retention-user'")).toEqual([
      "session-recent",
    ]);
    expect(await ids("select id from verification where identifier like 'identifier-%'")).toEqual([
      "verification-recent",
    ]);
    expect(
      await ids(
        "select token_hash as id from mini_account_link_request where target_user_id = 'retention-user'",
      ),
    ).toEqual(["link-recent"]);
  });
});
