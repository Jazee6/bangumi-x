import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  sessionMiddleware,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { touchMiniIdentity } from "./mini-identity-cleanup";

const REAUTH_ATTEMPT_TTL = 10 * 60 * 1000;
const CREDENTIAL_GRANT_TTL = 10 * 60 * 1000;
const CHALLENGE_TTL = 5 * 60 * 1000;
const CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

interface MiniBindingOptions {
  database: D1Database;
}

interface SessionRecord {
  id: string;
  userId: string;
  channel?: string;
}

interface ChallengeRow {
  id: string;
  status: string;
  expires_at: number;
  inspector_user_id: string | null;
  target_user_id: string;
  conflict_reason?: string | null;
  merge_nonce?: string | null;
  name?: string;
  image?: string | null;
}

interface MiniAccountRow {
  id: string;
  user_id: string;
}

function apiError(
  status: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "INTERNAL_SERVER_ERROR",
  code: string,
  message: string,
): APIError {
  return APIError.fromStatus(status, { code, message });
}

function asSession(value: unknown): SessionRecord {
  return value as SessionRecord;
}

function requireChannel(value: unknown, channel: "web" | "mini"): SessionRecord {
  const session = asSession(value);
  if (session.channel !== channel) {
    throw apiError("UNAUTHORIZED", "MINI_BINDING_INVALID_SESSION", "Session is not authorized");
  }
  return session;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function readChallenge(request: Request): Promise<string> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw apiError("BAD_REQUEST", "MINI_BINDING_MALFORMED", "Binding request is malformed");
  }
  if (
    typeof body !== "object" ||
    body === null ||
    !("challenge" in body) ||
    typeof body.challenge !== "string" ||
    !CHALLENGE_PATTERN.test(body.challenge)
  ) {
    throw apiError("BAD_REQUEST", "MINI_BINDING_MALFORMED", "Binding request is malformed");
  }
  return body.challenge;
}

async function expireChallenge(database: D1Database, row: ChallengeRow): Promise<ChallengeRow> {
  if (row.status !== "pending" || row.expires_at > Date.now()) return row;
  const now = Date.now();
  const result = await database
    .prepare(
      "UPDATE mini_binding_challenge SET status = 'expired', resolved_at = ? WHERE id = ? AND status = 'pending'",
    )
    .bind(now, row.id)
    .run();
  if (result.meta.changes === 0) {
    const current = await database
      .prepare(
        "SELECT id, status, expires_at, inspector_user_id, target_user_id FROM mini_binding_challenge WHERE id = ?",
      )
      .bind(row.id)
      .first<ChallengeRow>();
    if (current) return { ...row, ...current };
  }
  return { ...row, status: "expired" };
}

async function hasRecentGrant(
  database: D1Database,
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const grant = await database
    .prepare(
      "SELECT session_id FROM credential_management_grant WHERE session_id = ? AND user_id = ? AND expires_at > ?",
    )
    .bind(sessionId, userId, Date.now())
    .first();
  return Boolean(grant);
}

async function findMiniAccount(database: D1Database, userId: string): Promise<MiniAccountRow | null> {
  return database
    .prepare("SELECT id, user_id FROM account WHERE user_id = ? AND provider_id = 'wechat-mini'")
    .bind(userId)
    .first<MiniAccountRow>();
}

async function setConflict(
  database: D1Database,
  challengeId: string,
  reason: "openid" | "target",
): Promise<void> {
  await database
    .prepare(
      "UPDATE mini_binding_challenge SET status = 'conflict', conflict_reason = ?, resolved_at = ? WHERE id = ? AND status = 'pending'",
    )
    .bind(reason, Date.now(), challengeId)
    .run();
}

function migrateMiniIdentityData(
  _database: D1Database,
  _sourceUserId: string,
  _targetUserId: string,
): D1PreparedStatement[] {
  // Private MiniIdentity-owned business records will be moved here before user deletion.
  return [];
}

export function miniBinding(options: MiniBindingOptions): BetterAuthPlugin {
  const database = options.database;

  return {
    id: "mini-binding",
    endpoints: {
      getMiniBindingStatus: createAuthEndpoint(
        "/mini-binding/status",
        { method: "GET", use: [sessionMiddleware] },
        async (ctx) => {
          requireChannel(ctx.context.session.session, "web");
          if (ctx.context.session.user.isAnonymous) {
            throw apiError("FORBIDDEN", "MINI_BINDING_SIGNED_IN_REQUIRED", "Signed-in account required");
          }
          const account = await findMiniAccount(database, ctx.context.session.user.id);
          return ctx.json({ status: account ? ("bound" as const) : ("unbound" as const) });
        },
      ),
      createMiniBindingChallenge: createAuthEndpoint(
        "/mini-binding/challenge",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const session = requireChannel(ctx.context.session.session, "web");
          if (ctx.context.session.user.isAnonymous) {
            throw apiError("FORBIDDEN", "MINI_BINDING_SIGNED_IN_REQUIRED", "Signed-in account required");
          }
          const now = Date.now();
          if (!(await hasRecentGrant(database, session.id, ctx.context.session.user.id))) {
            throw apiError(
              "FORBIDDEN",
              "MINI_BINDING_RECENT_AUTH_REQUIRED",
              "Recent authentication is required",
            );
          }
          if (await findMiniAccount(database, ctx.context.session.user.id)) {
            throw apiError("FORBIDDEN", "MINI_BINDING_TARGET_CONFLICT", "Account is already bound");
          }

          const id = crypto.randomUUID();
          const secret = randomSecret();
          const secretHash = await sha256(secret);
          const expiresAt = now + CHALLENGE_TTL;
          const created = await database.batch([
            database
              .prepare(
                "UPDATE mini_binding_challenge SET status = 'expired', resolved_at = ? WHERE target_user_id = ? AND status = 'pending' AND expires_at <= ?",
              )
              .bind(now, ctx.context.session.user.id, now),
            database
              .prepare(
                "UPDATE mini_binding_challenge SET status = 'replaced', resolved_at = ? WHERE target_user_id = ? AND status = 'pending' AND expires_at > ?",
              )
              .bind(now, ctx.context.session.user.id, now),
            database
              .prepare(
                `INSERT INTO mini_binding_challenge (id, secret_hash, target_user_id, web_session_id, status, expires_at, created_at)
                 SELECT ?, ?, ?, ?, 'pending', ?, ?
                 WHERE NOT EXISTS (
                   SELECT 1 FROM account WHERE user_id = ? AND provider_id = 'wechat-mini'
                 )`,
              )
              .bind(id, secretHash, ctx.context.session.user.id, session.id, expiresAt, now, ctx.context.session.user.id),
          ]);
          if (created[2].meta.changes === 0) {
            throw apiError("FORBIDDEN", "MINI_BINDING_TARGET_CONFLICT", "Account is already bound");
          }
          return ctx.json({
            id,
            payload: `bgmx:mini-bind:v1:${secret}`,
            expiresAt,
            status: "pending" as const,
          });
        },
      ),
      getMiniBindingChallengeStatus: createAuthEndpoint(
        "/mini-binding/challenge/status",
        { method: "GET", use: [sessionMiddleware], requireRequest: true },
        async (ctx) => {
          const session = requireChannel(ctx.context.session.session, "web");
          const id = new URL(ctx.request.url).searchParams.get("id");
          if (!id || id.length > 64) {
            throw apiError("BAD_REQUEST", "MINI_BINDING_MALFORMED", "Binding request is malformed");
          }
          const row = await database
            .prepare(
              "SELECT id, status, expires_at, inspector_user_id, target_user_id, conflict_reason FROM mini_binding_challenge WHERE id = ? AND target_user_id = ? AND web_session_id = ?",
            )
            .bind(id, ctx.context.session.user.id, session.id)
            .first<ChallengeRow>();
          if (!row) {
            throw apiError("NOT_FOUND", "MINI_BINDING_NOT_FOUND", "Binding request was not found");
          }
          const current = await expireChallenge(database, row);
          return ctx.json({
            status: current.status,
            expiresAt: current.expires_at,
            ...(current.conflict_reason ? { conflictReason: current.conflict_reason } : {}),
          });
        },
      ),
      inspectMiniBindingChallenge: createAuthEndpoint(
        "/mini-binding/inspect",
        { method: "POST", use: [sessionMiddleware], requireRequest: true },
        async (ctx) => {
          const session = requireChannel(ctx.context.session.session, "mini");
          await touchMiniIdentity(database, session.userId);
          const challenge = await readChallenge(ctx.request);
          const secretHash = await sha256(challenge);
          const row = await database
            .prepare(
              "SELECT c.id, c.status, c.expires_at, c.inspector_user_id, c.target_user_id, u.name, u.image FROM mini_binding_challenge c JOIN user u ON u.id = c.target_user_id WHERE c.secret_hash = ?",
            )
            .bind(secretHash)
            .first<ChallengeRow>();
          if (!row) {
            throw apiError("NOT_FOUND", "MINI_BINDING_NOT_FOUND", "Binding request is unavailable");
          }
          const current = await expireChallenge(database, row);
          if (current.status !== "pending") {
            return ctx.json({
              status: current.status,
              expiresAt: current.expires_at,
              ...(current.conflict_reason ? { conflictReason: current.conflict_reason } : {}),
            });
          }
          const sourceUser = await database
            .prepare("SELECT is_anonymous FROM user WHERE id = ?")
            .bind(session.userId)
            .first<{ is_anonymous: number }>();
          if (!sourceUser?.is_anonymous) {
            await setConflict(database, current.id, "openid");
            return ctx.json({ status: "conflict" as const, conflictReason: "openid" as const, expiresAt: current.expires_at });
          }
          if (await findMiniAccount(database, current.target_user_id)) {
            await setConflict(database, current.id, "target");
            return ctx.json({ status: "conflict" as const, conflictReason: "target" as const, expiresAt: current.expires_at });
          }
          if (current.inspector_user_id && current.inspector_user_id !== session.userId) {
            throw apiError("NOT_FOUND", "MINI_BINDING_NOT_FOUND", "Binding request is unavailable");
          }
          if (!current.inspector_user_id) {
            const claimed = await database
              .prepare(
                "UPDATE mini_binding_challenge SET inspector_user_id = ? WHERE id = ? AND status = 'pending' AND inspector_user_id IS NULL AND expires_at > ?",
              )
              .bind(session.userId, current.id, Date.now())
              .run();
            if (claimed.meta.changes === 0) {
              const latest = await database
                .prepare(
                  "SELECT id, status, expires_at, inspector_user_id, target_user_id FROM mini_binding_challenge WHERE id = ?",
                )
                .bind(current.id)
                .first<ChallengeRow>();
              const latestState = latest
                ? await expireChallenge(database, { ...current, ...latest })
                : null;
              if (!latestState || latestState.inspector_user_id !== session.userId) {
                if (latestState && latestState.status !== "pending") {
                  return ctx.json({ status: latestState.status, expiresAt: latestState.expires_at });
                }
                throw apiError("NOT_FOUND", "MINI_BINDING_NOT_FOUND", "Binding request is unavailable");
              }
            }
          }
          return ctx.json({
            status: "pending" as const,
            profile: { name: current.name, image: current.image ?? null },
            expiresAt: current.expires_at,
          });
        },
      ),
      rejectMiniBindingChallenge: createAuthEndpoint(
        "/mini-binding/reject",
        { method: "POST", use: [sessionMiddleware], requireRequest: true },
        async (ctx) => {
          const session = requireChannel(ctx.context.session.session, "mini");
          await touchMiniIdentity(database, session.userId);
          const challenge = await readChallenge(ctx.request);
          const secretHash = await sha256(challenge);
          const row = await database
            .prepare(
              "SELECT id, status, expires_at, inspector_user_id, target_user_id FROM mini_binding_challenge WHERE secret_hash = ?",
            )
            .bind(secretHash)
            .first<ChallengeRow>();
          if (!row || row.inspector_user_id !== session.userId) {
            throw apiError("NOT_FOUND", "MINI_BINDING_NOT_FOUND", "Binding request is unavailable");
          }
          const current = await expireChallenge(database, row);
          if (current.status !== "pending") {
            return ctx.json({ status: current.status, expiresAt: current.expires_at });
          }
          const now = Date.now();
          const rejected = await database
            .prepare(
              "UPDATE mini_binding_challenge SET status = 'rejected', resolved_at = ? WHERE id = ? AND status = 'pending' AND inspector_user_id = ? AND expires_at > ?",
            )
            .bind(now, current.id, session.userId, now)
            .run();
          if (rejected.meta.changes === 0) {
            const latest = await database
              .prepare(
                "SELECT id, status, expires_at, inspector_user_id, target_user_id FROM mini_binding_challenge WHERE id = ?",
              )
              .bind(current.id)
              .first<ChallengeRow>();
            if (!latest) {
              throw apiError("NOT_FOUND", "MINI_BINDING_NOT_FOUND", "Binding request is unavailable");
            }
            const latestState = await expireChallenge(database, latest);
            return ctx.json({ status: latestState.status, expiresAt: latestState.expires_at });
          }
          return ctx.json({ status: "rejected" as const, expiresAt: current.expires_at });
        },
      ),
      confirmMiniBindingChallenge: createAuthEndpoint(
        "/mini-binding/confirm",
        { method: "POST", use: [sessionMiddleware], requireRequest: true },
        async (ctx) => {
          const sourceSession = requireChannel(ctx.context.session.session, "mini");
          await touchMiniIdentity(database, sourceSession.userId);
          const challenge = await readChallenge(ctx.request);
          const secretHash = await sha256(challenge);
          const row = await database
            .prepare(
              "SELECT id, status, expires_at, inspector_user_id, target_user_id, conflict_reason, merge_nonce FROM mini_binding_challenge WHERE secret_hash = ?",
            )
            .bind(secretHash)
            .first<ChallengeRow>();
          if (!row || row.inspector_user_id !== sourceSession.userId) {
            throw apiError("NOT_FOUND", "MINI_BINDING_NOT_FOUND", "Binding request is unavailable");
          }
          const current = await expireChallenge(database, row);
          if (current.status !== "pending") {
            return ctx.json({
              status: current.status,
              expiresAt: current.expires_at,
              ...(current.conflict_reason ? { conflictReason: current.conflict_reason } : {}),
            });
          }

          const sourceUser = await database
            .prepare("SELECT is_anonymous FROM user WHERE id = ?")
            .bind(sourceSession.userId)
            .first<{ is_anonymous: number }>();
          const sourceAccount = await findMiniAccount(database, sourceSession.userId);
          if (!sourceUser?.is_anonymous || !sourceAccount) {
            await setConflict(database, current.id, "openid");
            return ctx.json({ status: "conflict" as const, conflictReason: "openid" as const, expiresAt: current.expires_at });
          }
          if (await findMiniAccount(database, current.target_user_id)) {
            await setConflict(database, current.id, "target");
            return ctx.json({ status: "conflict" as const, conflictReason: "target" as const, expiresAt: current.expires_at });
          }

          const nonce = crypto.randomUUID();
          const now = Date.now();
          try {
            await database.batch([
              database
                .prepare(
                  `UPDATE mini_binding_challenge
                   SET status = 'confirmed', merge_nonce = ?, resolved_at = ?
                   WHERE id = ? AND status = 'pending' AND inspector_user_id = ? AND expires_at > ?
                     AND EXISTS (
                       SELECT 1 FROM user u JOIN account a ON a.user_id = u.id
                       WHERE u.id = ? AND u.is_anonymous = 1
                         AND a.id = ? AND a.provider_id = 'wechat-mini'
                     )
                     AND NOT EXISTS (
                       SELECT 1 FROM account a
                       WHERE a.user_id = ? AND a.provider_id = 'wechat-mini'
                     )`,
                )
                .bind(
                  nonce,
                  now,
                  current.id,
                  sourceSession.userId,
                  now,
                  sourceSession.userId,
                  sourceAccount.id,
                  current.target_user_id,
                ),
              ...migrateMiniIdentityData(database, sourceSession.userId, current.target_user_id),
              database
                .prepare(
                  "UPDATE account SET user_id = ?, updated_at = ? WHERE id = ? AND user_id = ? AND provider_id = 'wechat-mini' AND EXISTS (SELECT 1 FROM mini_binding_challenge WHERE id = ? AND merge_nonce = ? AND status = 'confirmed')",
                )
                .bind(current.target_user_id, now, sourceAccount.id, sourceSession.userId, current.id, nonce),
              database
                .prepare(
                  "DELETE FROM user WHERE id = ? AND is_anonymous = 1 AND NOT EXISTS (SELECT 1 FROM account WHERE user_id = ?) AND EXISTS (SELECT 1 FROM mini_binding_challenge WHERE id = ? AND merge_nonce = ? AND status = 'confirmed')",
                )
                .bind(sourceSession.userId, sourceSession.userId, current.id, nonce),
            ]);
          } catch {
            const reason = (await findMiniAccount(database, current.target_user_id)) ? "target" : "openid";
            await setConflict(database, current.id, reason);
            return ctx.json({ status: "conflict" as const, conflictReason: reason, expiresAt: current.expires_at });
          }

          const consumed = await database
            .prepare("SELECT status, merge_nonce FROM mini_binding_challenge WHERE id = ?")
            .bind(current.id)
            .first<{ status: string; merge_nonce: string | null }>();
          if (consumed?.status !== "confirmed" || consumed.merge_nonce !== nonce) {
            if (consumed?.status === "pending") {
              const reason = (await findMiniAccount(database, current.target_user_id)) ? "target" : "openid";
              await setConflict(database, current.id, reason);
              return ctx.json({ status: "conflict" as const, conflictReason: reason, expiresAt: current.expires_at });
            }
            return ctx.json({ status: consumed?.status ?? "consumed", expiresAt: current.expires_at });
          }

          const targetUser = await ctx.context.internalAdapter.findUserById(current.target_user_id);
          if (!targetUser) {
            throw apiError("INTERNAL_SERVER_ERROR", "MINI_BINDING_SESSION_FAILED", "Binding completed; sign in again to continue");
          }
          const newSession = await ctx.context.internalAdapter.createSession(targetUser.id, false, { channel: "mini" }, true);
          if (!newSession) {
            throw apiError("INTERNAL_SERVER_ERROR", "MINI_BINDING_SESSION_FAILED", "Binding completed; sign in again to continue");
          }
          const attachedAccount = await findMiniAccount(database, targetUser.id);
          if (!attachedAccount) {
            await database.prepare("DELETE FROM session WHERE id = ?").bind(newSession.id).run();
            throw apiError("UNAUTHORIZED", "MINI_BINDING_UNBOUND", "Mini binding is no longer active");
          }
          await setSessionCookie(ctx, { session: newSession, user: targetUser });
          return ctx.json({
            status: "confirmed" as const,
            expiresAt: current.expires_at,
            identity: {
              state: "bound" as const,
              profile: { name: targetUser.name, image: targetUser.image ?? null },
            },
          });
        },
      ),
      unbindMiniIdentity: createAuthEndpoint(
        "/mini-binding/unbind",
        { method: "POST", use: [sessionMiddleware] },
        async (ctx) => {
          const session = requireChannel(ctx.context.session.session, "web");
          if (ctx.context.session.user.isAnonymous) {
            throw apiError("FORBIDDEN", "MINI_BINDING_SIGNED_IN_REQUIRED", "Signed-in account required");
          }
          if (!(await hasRecentGrant(database, session.id, ctx.context.session.user.id))) {
            throw apiError("FORBIDDEN", "MINI_BINDING_RECENT_AUTH_REQUIRED", "Recent authentication is required");
          }
          const account = await findMiniAccount(database, ctx.context.session.user.id);
          if (!account) return ctx.json({ status: "unbound" as const });
          await database.batch([
            database.prepare("DELETE FROM account WHERE id = ? AND user_id = ?").bind(account.id, ctx.context.session.user.id),
            database.prepare("DELETE FROM session WHERE user_id = ? AND channel = 'mini'").bind(ctx.context.session.user.id),
          ]);
          return ctx.json({ status: "unbound" as const });
        },
      ),
    },
    hooks: {
      before: [
        {
          matcher(ctx) {
            return ctx.path === "/oauth2/link";
          },
          handler: createAuthMiddleware(async (ctx) => {
            const authSession = await getSessionFromCtx(ctx);
            if (
              !authSession ||
              asSession(authSession.session).channel !== "web" ||
              authSession.user.isAnonymous
            ) {
              throw apiError("UNAUTHORIZED", "MINI_BINDING_INVALID_SESSION", "Session is not authorized");
            }
          }),
        },
      ],
      after: [
        {
          matcher(ctx) {
            return ctx.path === "/oauth2/link";
          },
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned;
            const authSession = ctx.context.session;
            if (
              !authSession ||
              asSession(authSession.session).channel !== "web" ||
              authSession.user.isAnonymous ||
              typeof returned !== "object" ||
              returned === null ||
              !("url" in returned) ||
              typeof returned.url !== "string"
            ) {
              return;
            }
            const state = new URL(returned.url).searchParams.get("state");
            if (!state) return;
            const session = asSession(authSession.session);
            const accounts = await database
              .prepare("SELECT id FROM account WHERE user_id = ? AND provider_id = 'easy-auth'")
              .bind(authSession.user.id)
              .all<{ id: string }>();
            if (accounts.results.length !== 1) {
              throw apiError(
                "FORBIDDEN",
                "MINI_BINDING_REAUTH_UNAVAILABLE",
                "Account cannot be reauthenticated",
              );
            }
            const now = Date.now();
            await database
              .prepare(
                "INSERT INTO credential_management_attempt (state_hash, session_id, user_id, expected_account_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)",
              )
              .bind(
                await sha256(state),
                session.id,
                authSession.user.id,
                accounts.results[0].id,
                now + REAUTH_ATTEMPT_TTL,
                now,
              )
              .run();
          }),
        },
        {
          matcher(ctx) {
            return ctx.path?.startsWith("/oauth2/callback/") ?? false;
          },
          handler: createAuthMiddleware(async (ctx) => {
            const request = ctx.request;
            if (!request) return;
            const requestUrl = new URL(request.url);
            const state = requestUrl.searchParams.get("state");
            if (!state) return;
            const stateHash = await sha256(state);
            const attempt = await database
              .prepare(
                "SELECT session_id, user_id, expected_account_id, expires_at, created_at FROM credential_management_attempt WHERE state_hash = ?",
              )
              .bind(stateHash)
              .first<{
                session_id: string;
                user_id: string;
                expected_account_id: string;
                expires_at: number;
                created_at: number;
              }>();
            if (!attempt) return;

            const location = ctx.context.responseHeaders?.get("location");
            const failed = requestUrl.searchParams.has("error") || !location || new URL(location).searchParams.has("error");
            if (failed || attempt.expires_at <= Date.now()) {
              await database
                .prepare("DELETE FROM credential_management_attempt WHERE state_hash = ?")
                .bind(stateHash)
                .run();
              return;
            }

            const expectedAccount = await database
              .prepare(
                "SELECT id FROM account WHERE id = ? AND user_id = ? AND provider_id = 'easy-auth' AND updated_at >= ?",
              )
              .bind(attempt.expected_account_id, attempt.user_id, attempt.created_at)
              .first();
            const unexpectedAccount = await database
              .prepare(
                "SELECT id FROM account WHERE user_id = ? AND provider_id = 'easy-auth' AND id != ? AND (created_at >= ? OR updated_at >= ?)",
              )
              .bind(
                attempt.user_id,
                attempt.expected_account_id,
                attempt.created_at,
                attempt.created_at,
              )
              .first();
            if (!expectedAccount || unexpectedAccount) {
              await database
                .prepare("DELETE FROM credential_management_attempt WHERE state_hash = ?")
                .bind(stateHash)
                .run();
              return;
            }

            const now = Date.now();
            await database.batch([
              database
                .prepare("DELETE FROM credential_management_attempt WHERE state_hash = ?")
                .bind(stateHash),
              database
                .prepare(
                  "INSERT INTO credential_management_grant (session_id, user_id, authorized_at, expires_at) VALUES (?, ?, ?, ?) ON CONFLICT(session_id) DO UPDATE SET user_id = excluded.user_id, authorized_at = excluded.authorized_at, expires_at = excluded.expires_at",
                )
                .bind(attempt.session_id, attempt.user_id, now, now + CREDENTIAL_GRANT_TTL),
            ]);
          }),
        },
      ],
    },
  } satisfies BetterAuthPlugin;
}
