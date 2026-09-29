import { v7 as uuidv7 } from "uuid";

import type {
  MiniAccountLinkClaim,
  MiniAccountLinkCredential,
  MiniAccountLinkPreview,
  MiniAccountLinkResult,
  MiniAccountLinkWebStatus,
  MiniIdentitySession,
  MiniIdentityUser,
} from "share";
import type {
  D1Database,
  D1PreparedStatement,
  ImagesBinding,
  R2Bucket,
} from "@cloudflare/workers-types";

export const WECHAT_MINI_PROVIDER_ID = "wechat-mini";
type Fetcher = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const LINK_TTL_MS = 10 * 60 * 1000;
const LINK_CLAIM_FAILURE_LIMIT = 5;
const LINK_CLAIM_WINDOW_MS = 10 * 60 * 1000;
const LINK_QR_PREFIX = "bgmx:pair:";
const SHORT_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PROFILE_DAILY_LIMIT = 5;

export interface MiniIdentityBindings {
  DB?: D1Database;
  WEB_ORIGIN: string;
  SERVER_URL?: string;
  WECHAT_MINI_APP_ID?: string;
  WECHAT_MINI_APP_SECRET?: string;
  AVATARS?: R2Bucket;
  IMAGES?: ImagesBinding;
}

interface UserRow {
  id: string;
  name: string;
  email: string;
  email_verified: number;
  image: string | null;
  is_anonymous: number;
  created_at: number;
  updated_at: number;
}

interface LinkRow {
  token_hash: string;
  short_code_hash: string;
  claim_token_hash: string | null;
  source_user_id: string | null;
  target_user_id: string;
  status: "awaiting_source" | "awaiting_confirmation" | "complete" | "failed";
  preview_version: string | null;
  result_session_token: string | null;
  error_code: string | null;
  expires_at: number;
  created_at: number;
  updated_at: number;
  completed_at: number | null;
}

interface MiniProfileRow {
  user_id: string;
  avatar_key: string | null;
  mutation_day: string | null;
  mutation_count: number;
  link_claim_window_started_at: number | null;
  link_claim_failure_count: number;
}

interface WechatCodeSession {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

interface MergeCounts {
  collections: number;
  progress: number;
  lists: number;
}

function requireDatabase(bindings: MiniIdentityBindings): D1Database {
  if (!bindings.DB) throw new Error("The DB binding is not configured");
  return bindings.DB;
}

function randomToken() {
  return `${crypto.randomUUID().replaceAll("-", "")}${crypto.randomUUID().replaceAll("-", "")}`;
}

function randomShortCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const code = [...bytes].map((byte) => SHORT_CODE_ALPHABET[byte & 31]).join("");
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

export function normalizeMiniAccountLinkCode(value: string) {
  const code = value.trim().toUpperCase().replaceAll("-", "").replaceAll(" ", "");
  return code.length === 8 &&
    [...code].every((character) => SHORT_CODE_ALPHABET.includes(character))
    ? code
    : null;
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function miniUser(row: Pick<UserRow, "name" | "image" | "is_anonymous">) {
  return {
    name: row.name,
    image: row.image,
    editable: row.is_anonymous === 1,
  } satisfies MiniIdentityUser;
}

function issuer(appId: string) {
  return `https://api.weixin.qq.com/miniprogram/${appId}`;
}

function placeholderName() {
  const suffix = crypto.randomUUID().replaceAll("-", "").slice(0, 4).toUpperCase();
  return `番迹用户 ${suffix}`;
}

function placeholderEmail() {
  return `wechat-${crypto.randomUUID()}@placeholder.invalid`;
}

function dateKey(now: Date) {
  return now.toISOString().slice(0, 10);
}

async function getUser(database: D1Database, userId: string) {
  return (
    (await database
      .prepare(
        `select id, name, email, email_verified, image, is_anonymous, created_at, updated_at
         from user where id = ?`,
      )
      .bind(userId)
      .first<UserRow>()) ?? null
  );
}

async function getProfile(database: D1Database, userId: string) {
  return (
    (await database
      .prepare(
        `select user_id, avatar_key, mutation_day, mutation_count,
                link_claim_window_started_at, link_claim_failure_count
         from mini_profile where user_id = ?`,
      )
      .bind(userId)
      .first<MiniProfileRow>()) ?? null
  );
}

async function getCounts(database: D1Database, userId: string): Promise<MergeCounts> {
  const row = await database
    .prepare(
      `select
         (select count(*) from collection where user_id = ?) as collections,
         (select count(*) from progress where user_id = ?) as progress,
         (select count(*) from collection_list where user_id = ?) as lists`,
    )
    .bind(userId, userId, userId)
    .first<{
      collections: number;
      progress: number;
      lists: number;
    }>();
  const collections = Number(row?.collections ?? 0);
  const progress = Number(row?.progress ?? 0);
  const lists = Number(row?.lists ?? 0);
  return {
    collections,
    progress,
    lists,
  };
}

async function userDataFingerprint(database: D1Database, userId: string) {
  const [user, collections, progressRows, lists, members] = await Promise.all([
    getUser(database, userId),
    database
      .prepare(
        `select id, subject_id, collected_at from collection
         where user_id = ? order by subject_id, id`,
      )
      .bind(userId)
      .all(),
    database
      .prepare(
        `select id, subject_id, stage, completed_chapters, created_at, updated_at from progress
         where user_id = ? order by subject_id, id`,
      )
      .bind(userId)
      .all(),
    database
      .prepare(
        `select id, name, is_public, share_token, created_at, updated_at from collection_list
         where user_id = ? order by id`,
      )
      .bind(userId)
      .all(),
    database
      .prepare(
        `select member.id, member.list_id, member.subject_id, member.added_at
         from collection_list_member member
         join collection_list list on list.id = member.list_id
         where list.user_id = ? order by member.list_id, member.subject_id, member.id`,
      )
      .bind(userId)
      .all(),
  ]);
  return sha256(
    JSON.stringify({
      user,
      collections: collections.results,
      progress: progressRows.results,
      lists: lists.results,
      members: members.results,
    }),
  );
}

async function previewVersion(database: D1Database, sourceUserId: string, targetUserId: string) {
  const [source, target] = await Promise.all([
    userDataFingerprint(database, sourceUserId),
    userDataFingerprint(database, targetUserId),
  ]);
  return sha256(`${source}:${target}`);
}

async function getLinkByToken(database: D1Database, token: string) {
  const tokenHash = await sha256(token);
  return (
    (await database
      .prepare(`select * from mini_account_link_request where token_hash = ?`)
      .bind(tokenHash)
      .first<LinkRow>()) ?? null
  );
}

async function getLinkByClaimToken(database: D1Database, token: string) {
  const tokenHash = await sha256(token);
  return (
    (await database
      .prepare(`select * from mini_account_link_request where claim_token_hash = ?`)
      .bind(tokenHash)
      .first<LinkRow>()) ?? null
  );
}

async function getLinkByCredential(database: D1Database, credential: string) {
  if (credential.startsWith(LINK_QR_PREFIX)) {
    const token = credential.slice(LINK_QR_PREFIX.length);
    return /^[a-f\d]{64}$/i.test(token) ? getLinkByToken(database, token) : null;
  }
  const code = normalizeMiniAccountLinkCode(credential);
  if (!code) return null;
  const codeHash = await sha256(code);
  return (
    (await database
      .prepare(`select * from mini_account_link_request where short_code_hash = ?`)
      .bind(codeHash)
      .first<LinkRow>()) ?? null
  );
}

function ensureActiveLink(row: LinkRow | null, now: Date) {
  if (!row) throw new MiniIdentityError("MINI_ACCOUNT_LINK_NOT_FOUND", "关联请求不存在。", 404);
  if (row.expires_at <= now.getTime() && row.status !== "complete") {
    throw new MiniIdentityError(
      "MINI_ACCOUNT_LINK_EXPIRED",
      "关联凭证已过期，请在网页中重新生成。",
      409,
    );
  }
  return row;
}

async function insertSession(
  database: D1Database,
  userId: string,
  now: Date,
  ttl = SESSION_TTL_MS,
) {
  const token = randomToken();
  const expiresAt = new Date(now.getTime() + ttl);
  await database
    .prepare(
      `insert into session
       (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
       values (?, ?, ?, ?, ?, null, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      expiresAt.getTime(),
      token,
      now.getTime(),
      now.getTime(),
      "Mini",
      userId,
    )
    .run();
  return { token, expiresAt };
}

export class MiniIdentityError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 429 | 502 | 503,
    readonly retryable = false,
  ) {
    super(message);
    this.name = "MiniIdentityError";
  }
}

export function isMiniIdentityAvailable(bindings: MiniIdentityBindings) {
  return Boolean(
    bindings.DB &&
    bindings.SERVER_URL &&
    bindings.WECHAT_MINI_APP_ID &&
    bindings.WECHAT_MINI_APP_SECRET,
  );
}

async function exchangeWechatCode(bindings: MiniIdentityBindings, code: string, fetcher: Fetcher) {
  if (!bindings.WECHAT_MINI_APP_ID || !bindings.WECHAT_MINI_APP_SECRET) {
    throw new MiniIdentityError("MINI_AUTH_UNAVAILABLE", "当前环境不支持微信登录。", 503, true);
  }
  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", bindings.WECHAT_MINI_APP_ID);
  url.searchParams.set("secret", bindings.WECHAT_MINI_APP_SECRET);
  url.searchParams.set("js_code", code);
  url.searchParams.set("grant_type", "authorization_code");
  let response: Response;
  try {
    response = await fetcher(url);
  } catch {
    throw new MiniIdentityError(
      "INVALID_WECHAT_LOGIN",
      "微信登录暂时不可用，请稍后重试。",
      502,
      true,
    );
  }
  const body = (await response.json()) as WechatCodeSession;
  if (!response.ok || body.errcode || !body.openid) {
    throw new MiniIdentityError("INVALID_WECHAT_LOGIN", "微信登录凭证无效，请重试。", 401, true);
  }
  return body.openid;
}

export async function signInWithWechat(
  bindings: MiniIdentityBindings,
  code: string,
  now = new Date(),
  fetcher: Fetcher = fetch,
): Promise<MiniIdentitySession> {
  if (!isMiniIdentityAvailable(bindings)) {
    throw new MiniIdentityError("MINI_AUTH_UNAVAILABLE", "当前环境不支持微信登录。", 503, true);
  }
  if (!code || code.length > 256) {
    throw new MiniIdentityError("INVALID_WECHAT_LOGIN", "微信登录凭证无效。", 400);
  }
  const database = requireDatabase(bindings);
  const openId = await exchangeWechatCode(bindings, code, fetcher);
  const providerIssuer = issuer(bindings.WECHAT_MINI_APP_ID!);
  let row = await database
    .prepare(
      `select u.id, u.name, u.email, u.email_verified, u.image, u.is_anonymous,
              u.created_at, u.updated_at
       from account a join user u on u.id = a.user_id
       where a.issuer = ? and a.account_id = ? limit 1`,
    )
    .bind(providerIssuer, openId)
    .first<UserRow>();

  if (!row) {
    const userId = crypto.randomUUID();
    const timestamp = now.getTime();
    const created: UserRow = {
      id: userId,
      name: placeholderName(),
      email: placeholderEmail(),
      email_verified: 0,
      image: null,
      is_anonymous: 1,
      created_at: timestamp,
      updated_at: timestamp,
    };
    try {
      await database.batch([
        database
          .prepare(
            `insert into user
             (id, name, email, email_verified, image, is_anonymous, created_at, updated_at)
             values (?, ?, ?, 0, null, 1, ?, ?)`,
          )
          .bind(created.id, created.name, created.email, timestamp, timestamp),
        database
          .prepare(
            `insert into account
             (id, issuer, account_id, provider_id, user_id, created_at, updated_at)
             values (?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            crypto.randomUUID(),
            providerIssuer,
            openId,
            WECHAT_MINI_PROVIDER_ID,
            userId,
            timestamp,
            timestamp,
          ),
        database
          .prepare(
            `insert into mini_profile (user_id, mutation_count, updated_at) values (?, 0, ?)`,
          )
          .bind(userId, timestamp),
      ]);
      row = created;
    } catch {
      row = await database
        .prepare(
          `select u.id, u.name, u.email, u.email_verified, u.image, u.is_anonymous,
                  u.created_at, u.updated_at
           from account a join user u on u.id = a.user_id
           where a.issuer = ? and a.account_id = ? limit 1`,
        )
        .bind(providerIssuer, openId)
        .first<UserRow>();
      if (!row)
        throw new MiniIdentityError("INVALID_WECHAT_LOGIN", "微信登录暂时无法完成。", 503, true);
    }
  }

  const createdSession = await insertSession(database, row.id, now);
  return {
    token: createdSession.token,
    expiresAt: createdSession.expiresAt.toISOString(),
    user: miniUser(row),
  };
}

export async function getMiniIdentity(bindings: MiniIdentityBindings, userId: string) {
  const row = await getUser(requireDatabase(bindings), userId);
  return row ? miniUser(row) : null;
}

async function getWechatOpenId(bindings: MiniIdentityBindings, userId: string) {
  if (!bindings.WECHAT_MINI_APP_ID) return null;
  const row = await requireDatabase(bindings)
    .prepare(`select account_id from account where user_id = ? and issuer = ? limit 1`)
    .bind(userId, issuer(bindings.WECHAT_MINI_APP_ID))
    .first<{ account_id: string }>();
  return row?.account_id ?? null;
}

async function getWechatAccessToken(bindings: MiniIdentityBindings, now: Date, fetcher: Fetcher) {
  if (!bindings.WECHAT_MINI_APP_ID || !bindings.WECHAT_MINI_APP_SECRET) {
    throw new MiniIdentityError("MINI_AUTH_UNAVAILABLE", "微信服务配置不可用。", 503, true);
  }
  const database = requireDatabase(bindings);
  const cached = await database
    .prepare(`select token, expires_at from wechat_access_token where key = 'mini'`)
    .first<{ token: string; expires_at: number }>();
  if (cached && cached.expires_at > now.getTime() + 5 * 60 * 1000) return cached.token;

  let response: Response;
  try {
    response = await fetcher("https://api.weixin.qq.com/cgi-bin/stable_token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credential",
        appid: bindings.WECHAT_MINI_APP_ID,
        secret: bindings.WECHAT_MINI_APP_SECRET,
        force_refresh: false,
      }),
    });
  } catch {
    throw new MiniIdentityError("MINI_PROFILE_REVIEW_FAILED", "资料审核暂时不可用。", 503, true);
  }
  const body = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    errcode?: number;
  };
  if (!response.ok || body.errcode || !body.access_token) {
    throw new MiniIdentityError("MINI_PROFILE_REVIEW_FAILED", "资料审核暂时不可用。", 503, true);
  }
  const expiresAt = now.getTime() + (body.expires_in ?? 7200) * 1000;
  await database
    .prepare(
      `insert into wechat_access_token (key, token, expires_at, updated_at)
       values ('mini', ?, ?, ?)
       on conflict(key) do update set token = excluded.token,
         expires_at = excluded.expires_at, updated_at = excluded.updated_at`,
    )
    .bind(body.access_token, expiresAt, now.getTime())
    .run();
  return body.access_token;
}

async function consumeProfileMutation(database: D1Database, userId: string, now: Date) {
  const day = dateKey(now);
  const result = await database
    .prepare(
      `update mini_profile set mutation_day = ?,
         mutation_count = case when mutation_day = ? then mutation_count + 1 else 1 end,
         updated_at = ?
       where user_id = ? and
         (mutation_day is null or mutation_day != ? or mutation_count < ?)`,
    )
    .bind(day, day, now.getTime(), userId, day, PROFILE_DAILY_LIMIT)
    .run();
  if (Number(result.meta.changes) !== 1) {
    const profile = await getProfile(database, userId);
    if (!profile) {
      throw new MiniIdentityError("INVALID_MINI_PROFILE", "微信用户资料不存在。", 404);
    }
    throw new MiniIdentityError("MINI_PROFILE_RATE_LIMITED", "今天的资料修改次数已用完。", 429);
  }
}

async function assertEditableUser(database: D1Database, userId: string) {
  const row = await getUser(database, userId);
  if (!row || row.is_anonymous !== 1) {
    throw new MiniIdentityError("INVALID_MINI_PROFILE", "当前账号资料由身份提供方管理。", 403);
  }
  return row;
}

async function checkText(
  bindings: MiniIdentityBindings,
  userId: string,
  content: string,
  now: Date,
  fetcher: Fetcher,
) {
  const openid = await getWechatOpenId(bindings, userId);
  if (!openid) throw new MiniIdentityError("INVALID_MINI_PROFILE", "微信身份无效。", 403);
  const accessToken = await getWechatAccessToken(bindings, now, fetcher);
  const response = await fetcher(
    `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${encodeURIComponent(accessToken)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, version: 2, scene: 1, openid }),
    },
  );
  const body = (await response.json()) as {
    errcode?: number;
    result?: { suggest?: string };
  };
  if (!response.ok || body.errcode || body.result?.suggest !== "pass") {
    throw new MiniIdentityError(
      "MINI_PROFILE_REVIEW_FAILED",
      body.result?.suggest === "risky" ? "显示名未通过内容审核。" : "显示名审核暂时无法完成。",
      body.result?.suggest === "risky" ? 400 : 503,
      body.result?.suggest !== "risky",
    );
  }
}

export function normalizeMiniDisplayName(rawName: string) {
  const name = rawName.trim();
  const characters = Array.from(name);
  if (
    characters.length < 2 ||
    characters.length > 20 ||
    characters.some((character) => /[\p{Cc}\p{Cf}]/u.test(character))
  ) {
    throw new MiniIdentityError("INVALID_MINI_PROFILE", "显示名需为 2 至 20 个可见字符。", 400);
  }
  return name;
}

export async function updateMiniDisplayName(
  bindings: MiniIdentityBindings,
  userId: string,
  rawName: string,
  now = new Date(),
  fetcher: Fetcher = fetch,
) {
  const name = normalizeMiniDisplayName(rawName);
  const database = requireDatabase(bindings);
  await assertEditableUser(database, userId);
  await consumeProfileMutation(database, userId, now);
  await checkText(bindings, userId, name, now, fetcher);
  await database
    .prepare(`update user set name = ?, updated_at = ? where id = ? and is_anonymous = 1`)
    .bind(name, now.getTime(), userId)
    .run();
  return getMiniIdentity(bindings, userId);
}

const AVATAR_EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const AVATAR_FILE_PATTERN = /^[a-f0-9]{32}\.(?:jpg|png|webp)$/;

export function detectMiniAvatarMediaType(bytes: Uint8Array): "image/jpeg" | "image/png" | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (
    bytes.length >= pngSignature.length &&
    pngSignature.every((byte, index) => bytes[index] === byte)
  ) {
    return "image/png";
  }
  return null;
}

export async function submitMiniAvatar(
  bindings: MiniIdentityBindings,
  userId: string,
  file: File,
  now = new Date(),
) {
  if (!bindings.AVATARS || !bindings.IMAGES || !bindings.SERVER_URL) {
    throw new MiniIdentityError("MINI_AUTH_UNAVAILABLE", "头像服务暂时不可用。", 503, true);
  }
  if (file.size <= 0 || file.size > 2 * 1024 * 1024) {
    throw new MiniIdentityError(
      "INVALID_MINI_PROFILE",
      "头像需为不超过 2 MiB 的 JPEG 或 PNG 图片。",
      400,
    );
  }
  const contents = await file.arrayBuffer();
  const mediaType = detectMiniAvatarMediaType(new Uint8Array(contents));
  if (!mediaType) {
    throw new MiniIdentityError(
      "INVALID_MINI_PROFILE",
      "头像需为不超过 2 MiB 的 JPEG 或 PNG 图片。",
      400,
    );
  }
  const database = requireDatabase(bindings);
  await assertEditableUser(database, userId);
  await consumeProfileMutation(database, userId, now);
  const previousProfile = await getProfile(database, userId);

  // 头像来自 chooseAvatar，基础库 2.24.4 起微信已对其做内容安全检测，未通过的图片不会回调。
  // 服务端不再调用 mediaCheckAsync：微信服务器经常无法下载 Cloudflare 上的候选图（-1008）。
  // DOM 与 workers-types 的 ReadableStream 声明不兼容，运行时是同一个对象。
  const source = file.stream() as unknown as Parameters<ImagesBinding["input"]>[0];
  const transformed = await bindings.IMAGES.input(source)
    .transform({ width: 512, height: 512, fit: "cover" })
    .output({ format: "image/webp", quality: 82 });
  const response = transformed.response();
  if (!response.ok || !response.body) {
    throw new MiniIdentityError("MINI_AUTH_UNAVAILABLE", "头像处理失败，请稍后重试。", 503, true);
  }
  // R2 rejects streams without a known length, which the Images binding output is.
  const webp = await response.arrayBuffer();
  // chooseAvatar 给的通常已是裁剪压缩过的小图，转 webp 未必更小，保留体积更小的一份。
  const [bytes, contentType] =
    webp.byteLength < contents.byteLength ? [webp, "image/webp" as const] : [contents, mediaType];
  const avatarFile = `${crypto.randomUUID().replaceAll("-", "")}.${AVATAR_EXTENSIONS[contentType]}`;
  const avatarKey = `avatars/${avatarFile}`;
  await bindings.AVATARS.put(avatarKey, bytes, {
    httpMetadata: {
      contentType,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  const imageUrl = `${bindings.SERVER_URL}/mini/avatars/${avatarFile}`;
  await database.batch([
    database
      .prepare(`update user set image = ?, updated_at = ? where id = ? and is_anonymous = 1`)
      .bind(imageUrl, now.getTime(), userId),
    database
      .prepare(`update mini_profile set avatar_key = ?, updated_at = ? where user_id = ?`)
      .bind(avatarKey, now.getTime(), userId),
  ]);
  if (previousProfile?.avatar_key) await bindings.AVATARS.delete(previousProfile.avatar_key);
  return (await getMiniIdentity(bindings, userId)) as MiniIdentityUser;
}

export async function getAvatar(bindings: MiniIdentityBindings, avatarFile: string) {
  if (!bindings.AVATARS || !AVATAR_FILE_PATTERN.test(avatarFile)) return null;
  return bindings.AVATARS.get(`avatars/${avatarFile}`);
}

function accountLinkParty(user: UserRow, counts: MergeCounts) {
  return {
    name: user.name,
    image: user.image,
    collections: counts.collections,
    progress: counts.progress,
    lists: counts.lists,
  };
}

export async function createAccountLink(
  bindings: MiniIdentityBindings,
  targetUserId: string,
  now = new Date(),
): Promise<MiniAccountLinkCredential> {
  const database = requireDatabase(bindings);
  const target = await getUser(database, targetUserId);
  if (!target || target.is_anonymous === 1) {
    throw new MiniIdentityError("UNAUTHORIZED", "请先登录 Bangumi X 账号。", 401);
  }
  const wechatAccount = await database
    .prepare(`select id from account where user_id = ? and provider_id = ? limit 1`)
    .bind(target.id, WECHAT_MINI_PROVIDER_ID)
    .first<{ id: string }>();
  if (wechatAccount) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_CONFLICT", "该账号已经关联番迹微信用户。", 409);
  }

  const token = randomToken();
  const shortCode = randomShortCode();
  const tokenHash = await sha256(token);
  const shortCodeHash = await sha256(normalizeMiniAccountLinkCode(shortCode) ?? "");
  const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
  await database.batch([
    database
      .prepare(
        `update mini_account_link_request set status = 'failed', error_code = 'superseded',
         updated_at = ? where target_user_id = ? and status in ('awaiting_source', 'awaiting_confirmation')`,
      )
      .bind(now.getTime(), target.id),
    database
      .prepare(
        `insert into mini_account_link_request
         (token_hash, short_code_hash, target_user_id, status, expires_at, created_at, updated_at)
         values (?, ?, ?, 'awaiting_source', ?, ?, ?)`,
      )
      .bind(tokenHash, shortCodeHash, target.id, expiresAt.getTime(), now.getTime(), now.getTime()),
  ]);
  return {
    token,
    qrPayload: `${LINK_QR_PREFIX}${token}`,
    shortCode,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function getAccountLinkWebStatus(
  bindings: MiniIdentityBindings,
  token: string,
  targetUserId: string,
  now = new Date(),
): Promise<MiniAccountLinkWebStatus> {
  const link = ensureActiveLink(await getLinkByToken(requireDatabase(bindings), token), now);
  if (link.target_user_id !== targetUserId) {
    throw new MiniIdentityError("UNAUTHORIZED", "关联凭证不属于当前账号。", 401);
  }
  return { state: link.status, expiresAt: new Date(link.expires_at).toISOString() };
}

function assertAccountLinkClaimAllowed(profile: MiniProfileRow | null, now: Date) {
  if (
    profile?.link_claim_window_started_at &&
    now.getTime() - profile.link_claim_window_started_at < LINK_CLAIM_WINDOW_MS &&
    profile.link_claim_failure_count >= LINK_CLAIM_FAILURE_LIMIT
  ) {
    throw new MiniIdentityError(
      "MINI_ACCOUNT_LINK_RATE_LIMITED",
      "配对码尝试次数过多，请稍后再试。",
      429,
      true,
    );
  }
}

async function recordAccountLinkClaimFailure(
  database: D1Database,
  sourceUserId: string,
  profile: MiniProfileRow | null,
  now: Date,
) {
  const inWindow =
    profile?.link_claim_window_started_at &&
    now.getTime() - profile.link_claim_window_started_at < LINK_CLAIM_WINDOW_MS;
  await database
    .prepare(
      `update mini_profile set link_claim_window_started_at = ?, link_claim_failure_count = ?,
       updated_at = ? where user_id = ?`,
    )
    .bind(
      inWindow ? profile.link_claim_window_started_at : now.getTime(),
      inWindow ? profile.link_claim_failure_count + 1 : 1,
      now.getTime(),
      sourceUserId,
    )
    .run();
}

async function buildAccountLinkPreview(
  database: D1Database,
  link: LinkRow,
  now: Date,
): Promise<MiniAccountLinkPreview> {
  if (!link.source_user_id) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_CONFLICT", "关联凭证尚未由小程序认领。", 409);
  }
  const [source, target, sourceCounts, targetCounts] = await Promise.all([
    getUser(database, link.source_user_id),
    getUser(database, link.target_user_id),
    getCounts(database, link.source_user_id),
    getCounts(database, link.target_user_id),
  ]);
  if (!source || !target) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_NOT_FOUND", "关联用户不存在。", 404);
  }
  const version = await previewVersion(database, source.id, target.id);
  await database
    .prepare(
      `update mini_account_link_request set preview_version = ?, updated_at = ? where token_hash = ?`,
    )
    .bind(version, now.getTime(), link.token_hash)
    .run();
  return {
    state: "awaiting_confirmation",
    source: accountLinkParty(source, sourceCounts),
    target: accountLinkParty(target, targetCounts),
    previewVersion: version,
    expiresAt: new Date(link.expires_at).toISOString(),
  };
}

export async function claimAccountLink(
  bindings: MiniIdentityBindings,
  sourceUserId: string,
  credential: string,
  now = new Date(),
): Promise<MiniAccountLinkClaim> {
  const database = requireDatabase(bindings);
  const source = await assertEditableUser(database, sourceUserId);
  const profile = await getProfile(database, source.id);
  assertAccountLinkClaimAllowed(profile, now);
  const found = await getLinkByCredential(database, credential.trim());
  if (!found) {
    await recordAccountLinkClaimFailure(database, source.id, profile, now);
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_NOT_FOUND", "二维码或配对码无效。", 404);
  }
  const link = ensureActiveLink(found, now);
  if (link.status !== "awaiting_source") {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_CONFLICT", "关联凭证已被使用。", 409);
  }
  const target = await getUser(database, link.target_user_id);
  if (!target || target.is_anonymous === 1) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_NOT_FOUND", "目标账号不存在。", 404);
  }
  const wechatAccount = await database
    .prepare(`select id from account where user_id = ? and provider_id = ? limit 1`)
    .bind(target.id, WECHAT_MINI_PROVIDER_ID)
    .first<{ id: string }>();
  if (wechatAccount) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_CONFLICT", "该账号已经关联其他微信用户。", 409);
  }

  const claimToken = randomToken();
  const claimTokenHash = await sha256(claimToken);
  const version = await previewVersion(database, source.id, target.id);
  const claimed = await database
    .prepare(
      `update mini_account_link_request set source_user_id = ?, claim_token_hash = ?,
       preview_version = ?, status = 'awaiting_confirmation', updated_at = ?
       where token_hash = ? and status = 'awaiting_source'`,
    )
    .bind(source.id, claimTokenHash, version, now.getTime(), link.token_hash)
    .run();
  if (claimed.meta.changes !== 1) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_CONFLICT", "关联凭证已被使用。", 409);
  }
  await database.batch([
    database
      .prepare(
        `update mini_account_link_request set status = 'failed', error_code = 'superseded',
         updated_at = ? where source_user_id = ? and token_hash <> ?
         and status = 'awaiting_confirmation'`,
      )
      .bind(now.getTime(), source.id, link.token_hash),
    database
      .prepare(
        `update mini_profile set link_claim_window_started_at = null,
         link_claim_failure_count = 0, updated_at = ? where user_id = ?`,
      )
      .bind(now.getTime(), source.id),
  ]);
  return {
    claimToken,
    preview: await buildAccountLinkPreview(
      database,
      { ...link, source_user_id: source.id, claim_token_hash: claimTokenHash },
      now,
    ),
  };
}

export async function getAccountLinkPreview(
  bindings: MiniIdentityBindings,
  claimToken: string,
  sourceUserId: string,
  now = new Date(),
): Promise<MiniAccountLinkPreview> {
  const database = requireDatabase(bindings);
  const link = ensureActiveLink(await getLinkByClaimToken(database, claimToken), now);
  if (link.status !== "awaiting_confirmation" || link.source_user_id !== sourceUserId) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_CONFLICT", "关联确认状态无效。", 409);
  }
  return buildAccountLinkPreview(database, link, now);
}

async function uniqueImportedListNames(
  database: D1Database,
  sourceUserId: string,
  targetUserId: string,
) {
  const sourceRows = await database
    .prepare(`select id, name from collection_list where user_id = ? order by created_at, id`)
    .bind(sourceUserId)
    .all<{ id: string; name: string }>();
  const targetRows = await database
    .prepare(`select name from collection_list where user_id = ?`)
    .bind(targetUserId)
    .all<{ name: string }>();
  const used = new Set(targetRows.results.map((row) => row.name));
  return sourceRows.results.map((row) => {
    let name = row.name;
    if (used.has(name)) {
      const suffix = "（来自微信）";
      const base = Array.from(name)
        .slice(0, 50 - Array.from(suffix).length)
        .join("");
      name = `${base}${suffix}`;
      let sequence = 2;
      while (used.has(name)) {
        const numberedSuffix = `（来自微信 ${sequence}）`;
        name = `${Array.from(row.name)
          .slice(0, 50 - Array.from(numberedSuffix).length)
          .join("")}${numberedSuffix}`;
        sequence += 1;
      }
    }
    used.add(name);
    return { id: row.id, name };
  });
}

export async function confirmAccountLink(
  bindings: MiniIdentityBindings,
  claimToken: string,
  sourceUserId: string,
  expectedVersion: string,
  now = new Date(),
): Promise<MiniAccountLinkResult> {
  const database = requireDatabase(bindings);
  const link = ensureActiveLink(await getLinkByClaimToken(database, claimToken), now);
  if (link.status !== "awaiting_confirmation" || link.source_user_id !== sourceUserId) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_CONFLICT", "账号关联状态无效。", 409);
  }
  const [source, target, sourceCounts] = await Promise.all([
    getUser(database, sourceUserId),
    getUser(database, link.target_user_id),
    getCounts(database, sourceUserId),
  ]);
  if (!source || !target) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_NOT_FOUND", "关联用户不存在。", 404);
  }
  const currentVersion = await previewVersion(database, source.id, target.id);
  if (currentVersion !== expectedVersion || currentVersion !== link.preview_version) {
    throw new MiniIdentityError(
      "MINI_ACCOUNT_LINK_CHANGED",
      "个人数据已有变化，请重新确认。",
      409,
      true,
    );
  }
  const wechatConflict = await database
    .prepare(`select id from account where user_id = ? and provider_id = ? limit 1`)
    .bind(target.id, WECHAT_MINI_PROVIDER_ID)
    .first<{ id: string }>();
  if (wechatConflict) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_CONFLICT", "该账号已经关联其他微信用户。", 409);
  }
  const sourceProfile = await getProfile(database, source.id);
  const listNames = await uniqueImportedListNames(database, source.id, target.id);
  const createdSession = {
    id: crypto.randomUUID(),
    token: randomToken(),
    expiresAt: now.getTime() + SESSION_TTL_MS,
  };
  const resultSessionToken = createdSession.token;
  const statements: D1PreparedStatement[] = [
    database
      .prepare(
        `update collection as target set collected_at = min(target.collected_at,
             (select source.collected_at from collection source
              where source.user_id = ? and source.subject_id = target.subject_id))
           where target.user_id = ? and exists
             (select 1 from collection source where source.user_id = ?
              and source.subject_id = target.subject_id)`,
      )
      .bind(source.id, target.id, source.id),
    database
      .prepare(
        `delete from collection where user_id = ? and exists
           (select 1 from collection target where target.user_id = ?
            and target.subject_id = collection.subject_id)`,
      )
      .bind(source.id, target.id),
    database
      .prepare(`update collection set user_id = ? where user_id = ?`)
      .bind(target.id, source.id),
    database
      .prepare(
        `update progress as target set
             stage = case when target.stage = 'completed' or
               (select source.stage from progress source where source.user_id = ?
                and source.subject_id = target.subject_id) = 'completed'
               then 'completed' else 'in_progress' end,
             completed_chapters = case
               when target.completed_chapters is null and
                 (select source.completed_chapters from progress source where source.user_id = ?
                  and source.subject_id = target.subject_id) is null then null
               else max(coalesce(target.completed_chapters, 0), coalesce(
                 (select source.completed_chapters from progress source where source.user_id = ?
                  and source.subject_id = target.subject_id), 0)) end,
             updated_at = max(target.updated_at, coalesce(
               (select source.updated_at from progress source where source.user_id = ?
                and source.subject_id = target.subject_id), target.updated_at))
           where target.user_id = ? and exists
             (select 1 from progress source where source.user_id = ?
              and source.subject_id = target.subject_id)`,
      )
      .bind(source.id, source.id, source.id, source.id, target.id, source.id),
    database
      .prepare(
        `delete from progress where user_id = ? and exists
           (select 1 from progress target where target.user_id = ?
            and target.subject_id = progress.subject_id)`,
      )
      .bind(source.id, target.id),
    database
      .prepare(`update progress set user_id = ? where user_id = ?`)
      .bind(target.id, source.id),
    ...listNames.map((list) =>
      database
        .prepare(`update collection_list set user_id = ?, name = ?, updated_at = ? where id = ?`)
        .bind(target.id, list.name, now.getTime(), list.id),
    ),
    database
      .prepare(
        `update account set user_id = ?, updated_at = ? where user_id = ? and provider_id = ?`,
      )
      .bind(target.id, now.getTime(), source.id, WECHAT_MINI_PROVIDER_ID),
    database.prepare(`delete from session where user_id = ?`).bind(source.id),
    database.prepare(`delete from mini_profile where user_id = ?`).bind(source.id),
    database.prepare(`delete from user where id = ?`).bind(source.id),
    database
      .prepare(
        `insert into session
           (id, expires_at, token, created_at, updated_at, ip_address, user_agent, user_id)
           values (?, ?, ?, ?, ?, null, 'Mini', ?)`,
      )
      .bind(
        createdSession.id,
        createdSession.expiresAt,
        createdSession.token,
        now.getTime(),
        now.getTime(),
        target.id,
      ),
  ];

  statements.push(
    database
      .prepare(
        `insert into user_merge_audit
         (id, source_user_id, target_user_id, result_type, collection_count,
          progress_count, list_count, created_at)
         values (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        uuidv7(),
        source.id,
        target.id,
        "user_merge",
        sourceCounts.collections,
        sourceCounts.progress,
        sourceCounts.lists,
        now.getTime(),
      ),
    database
      .prepare(
        `update mini_account_link_request set status = 'complete',
         result_session_token = ?, completed_at = ?, updated_at = ? where token_hash = ?`,
      )
      .bind(resultSessionToken, now.getTime(), now.getTime(), link.token_hash),
  );
  await database.batch(statements as [D1PreparedStatement, ...D1PreparedStatement[]]);
  if (sourceProfile?.avatar_key) await bindings.AVATARS?.delete(sourceProfile.avatar_key);

  return { state: "complete" };
}

export async function cancelAccountLink(
  bindings: MiniIdentityBindings,
  claimToken: string,
  sourceUserId: string,
  now = new Date(),
) {
  const database = requireDatabase(bindings);
  const link = ensureActiveLink(await getLinkByClaimToken(database, claimToken), now);
  if (link.status !== "awaiting_confirmation" || link.source_user_id !== sourceUserId) {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_CONFLICT", "关联确认状态无效。", 409);
  }
  await database
    .prepare(
      `update mini_account_link_request set status = 'failed', error_code = 'cancelled',
       updated_at = ? where token_hash = ? and status = 'awaiting_confirmation'`,
    )
    .bind(now.getTime(), link.token_hash)
    .run();
}

export async function consumeAccountLinkResult(
  bindings: MiniIdentityBindings,
  claimToken: string,
  now = new Date(),
): Promise<MiniAccountLinkResult> {
  const database = requireDatabase(bindings);
  const link = ensureActiveLink(await getLinkByClaimToken(database, claimToken), now);
  if (link.status === "failed") {
    return { state: "failed", message: "账号关联未完成，请重试。" };
  }
  if (link.status !== "complete") return { state: "awaiting_confirmation" };
  const finalUser = await getUser(database, link.target_user_id);
  return {
    state: "complete",
    ...(link.result_session_token && link.completed_at
      ? {
          sessionToken: link.result_session_token,
          expiresAt: new Date(link.completed_at + SESSION_TTL_MS).toISOString(),
        }
      : {}),
    ...(finalUser ? { user: miniUser(finalUser) } : {}),
  };
}

export async function acknowledgeAccountLinkResult(
  bindings: MiniIdentityBindings,
  claimToken: string,
) {
  const database = requireDatabase(bindings);
  const link = await getLinkByClaimToken(database, claimToken);
  if (!link || link.status !== "complete") {
    throw new MiniIdentityError("MINI_ACCOUNT_LINK_NOT_FOUND", "关联结果不存在。", 404);
  }
  await database
    .prepare(
      `update mini_account_link_request set result_session_token = null,
       claim_token_hash = null where token_hash = ?`,
    )
    .bind(link.token_hash)
    .run();
}
