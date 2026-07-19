const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export async function touchMiniIdentity(database: D1Database, userId: string): Promise<void> {
  await database
    .prepare("UPDATE mini_identity SET last_active_at = ? WHERE user_id = ?")
    .bind(Date.now(), userId)
    .run();
}

export async function cleanupInactiveMiniIdentities(database: D1Database): Promise<number> {
  const cutoff = Date.now() - RETENTION_MS;
  const result = await database
    .prepare(
      `DELETE FROM user
       WHERE is_anonymous = 1
         AND EXISTS (
           SELECT 1 FROM mini_identity m
           WHERE m.user_id = user.id AND m.last_active_at <= ? AND m.has_business_data = 0
         )
         AND EXISTS (
           SELECT 1 FROM account a
           WHERE a.user_id = user.id AND a.provider_id = 'wechat-mini'
         )
         AND NOT EXISTS (
           SELECT 1 FROM session s
           WHERE s.user_id = user.id AND s.channel = 'mini' AND s.expires_at > ?
         )`,
    )
    .bind(cutoff, Date.now())
    .run();
  return result.meta.changes;
}
