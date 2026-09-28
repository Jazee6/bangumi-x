import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, test } from "vitest";

import {
  WECHAT_MINI_PROVIDER_ID,
  acknowledgeAccountLinkResult,
  claimAccountLink,
  confirmAccountLink,
  consumeAccountLinkResult,
  createAccountLink,
} from "./mini-identity";

const db = env.DB;

async function seedUsers(now: number) {
  await db
    .prepare(
      `insert into user
       (id, name, email, email_verified, image, is_anonymous, created_at, updated_at)
       values (?, ?, ?, 1, null, ?, ?, ?)`,
    )
    .bind("mini-user", "微信用户", "mini@example.invalid", 1, now, now)
    .run();
  await db
    .prepare(
      `insert into user
       (id, name, email, email_verified, image, is_anonymous, created_at, updated_at)
       values (?, ?, ?, 1, null, ?, ?, ?)`,
    )
    .bind("web-user", "Web 用户", "web@example.test", 0, now, now)
    .run();

  const insertAccount = `insert into account
     (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
     values (?, ?, ?, ?, ?, ?, ?)`;
  await db
    .prepare(insertAccount)
    .bind(
      "wechat-account",
      "https://api.weixin.qq.com/miniprogram/test",
      "openid",
      WECHAT_MINI_PROVIDER_ID,
      "mini-user",
      now,
      now,
    )
    .run();
  await db
    .prepare(insertAccount)
    .bind(
      "web-account",
      "https://account.example.test",
      "subject",
      "easy-auth",
      "web-user",
      now,
      now,
    )
    .run();

  await db
    .prepare(`insert into mini_profile (user_id, mutation_count, updated_at) values (?, 0, ?)`)
    .bind("mini-user", now)
    .run();
  await db
    .prepare(
      `insert into session
       (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
       values (?, ?, ?, ?, ?, null, 'Mini', ?)`,
    )
    .bind("mini-session", now + 60_000, "old-session", now, now, "mini-user")
    .run();
  await db
    .prepare(
      `insert into subject_snapshot
       (id, subject_id, title, type, poster_source_url, nsfw, total_chapters, updated_at)
       values ('snapshot', 1, '条目', '动画', null, 0, 12, ?)`,
    )
    .bind(now)
    .run();

  const insertCollection = `insert into collection (id, user_id, subject_id, collected_at) values (?, ?, 1, ?)`;
  await db
    .prepare(insertCollection)
    .bind("mini-collection", "mini-user", now - 2000)
    .run();
  await db
    .prepare(insertCollection)
    .bind("web-collection", "web-user", now - 1000)
    .run();

  const insertProgress = `insert into progress
     (id, user_id, subject_id, stage, completed_chapters, created_at, updated_at)
     values (?, ?, 1, ?, ?, ?, ?)`;
  await db
    .prepare(insertProgress)
    .bind("mini-progress", "mini-user", "completed", 12, now - 2000, now - 500)
    .run();
  await db
    .prepare(insertProgress)
    .bind("web-progress", "web-user", "in_progress", 5, now - 1000, now - 1000)
    .run();

  const insertList = `insert into collection_list
     (id, user_id, name, is_public, share_token, created_at, updated_at)
     values (?, ?, '追番', 0, ?, ?, ?)`;
  await db
    .prepare(insertList)
    .bind("mini-list", "mini-user", "mini-share", now - 2000, now - 2000)
    .run();
  await db
    .prepare(insertList)
    .bind("web-list", "web-user", "web-share", now - 1000, now - 1000)
    .run();
}

describe("Mini account pairing", () => {
  beforeAll(async () => {
    await applyD1Migrations(db, env.TEST_MIGRATIONS);
  });

  test("merges the claimed Mini user into the Web user and recovers the new session", async () => {
    const now = new Date("2026-09-17T12:00:00.000Z");
    await seedUsers(now.getTime());
    const bindings = {
      DB: db,
      WEB_ORIGIN: "https://web.example.test",
    };

    const credential = await createAccountLink(bindings, "web-user", now);
    expect(credential.qrPayload).toBe(`bgmx:pair:${credential.token}`);
    expect(credential.shortCode).toMatch(/^[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/);

    const claim = await claimAccountLink(bindings, "mini-user", credential.shortCode, now);
    expect(claim.preview.source.name).toBe("微信用户");
    expect(claim.preview.target.name).toBe("Web 用户");
    expect(claim.preview.source).toMatchObject({ collections: 1, progress: 1, lists: 1 });
    expect(claim.preview.target).toMatchObject({ collections: 1, progress: 1, lists: 1 });

    await confirmAccountLink(
      bindings,
      claim.claimToken,
      "mini-user",
      claim.preview.previewVersion,
      now,
    );
    const result = await consumeAccountLinkResult(bindings, claim.claimToken, now);

    expect(result.state).toBe("complete");
    expect(result.sessionToken).toEqual(expect.any(String));
    expect(result.expiresAt).toBe("2026-09-24T12:00:00.000Z");
    expect(result.user?.name).toBe("Web 用户");
    expect(await db.prepare(`select id from user where id = 'mini-user'`).first()).toBeNull();
    expect(
      await db.prepare(`select user_id from account where id = 'wechat-account'`).first(),
    ).toEqual({ user_id: "web-user" });
    expect(await db.prepare(`select result_type from user_merge_audit`).first()).toEqual({
      result_type: "user_merge",
    });
    expect(
      await db
        .prepare(
          `select collected_at from collection where user_id = 'web-user' and subject_id = 1`,
        )
        .first(),
    ).toEqual({ collected_at: now.getTime() - 2000 });
    expect(
      await db
        .prepare(
          `select stage, completed_chapters from progress
           where user_id = 'web-user' and subject_id = 1`,
        )
        .first(),
    ).toEqual({ stage: "completed", completed_chapters: 12 });
    expect(
      await (
        await db
          .prepare(`select name from collection_list where user_id = 'web-user' order by name`)
          .all()
      ).results,
    ).toEqual([{ name: "追番" }, { name: "追番（来自微信）" }]);

    await acknowledgeAccountLinkResult(bindings, claim.claimToken);
    expect(
      await db.prepare(`select result_session_token from mini_account_link_request`).first(),
    ).toEqual({ result_session_token: null });
  });
});
