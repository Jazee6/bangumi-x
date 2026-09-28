import type { MiniIdentitySession, MiniIdentityUser } from "share";

import {
  PublicApiError,
  requestApi,
  transportError,
  uploadApiFile,
  type ApiRequestOptions,
} from "./request";

const SESSION_STORAGE_KEY = "bangumi-x-mini-session-v1";
const EXPIRY_SKEW_MS = 30_000;

let sessionLoaded = false;
let currentSession: MiniIdentitySession | null = null;
let signInPromise: Promise<MiniIdentitySession> | null = null;

function isMiniIdentityUser(value: unknown): value is MiniIdentityUser {
  if (!value || typeof value !== "object") return false;
  const user = value as Partial<MiniIdentityUser>;
  return (
    typeof user.name === "string" &&
    (typeof user.image === "string" || user.image === null) &&
    typeof user.editable === "boolean" &&
    typeof user.avatarReviewPending === "boolean"
  );
}

function isMiniIdentitySession(value: unknown): value is MiniIdentitySession {
  if (!value || typeof value !== "object") return false;
  const session = value as Partial<MiniIdentitySession>;
  return (
    typeof session.token === "string" &&
    Boolean(session.token) &&
    typeof session.expiresAt === "string" &&
    Number.isFinite(Date.parse(session.expiresAt)) &&
    isMiniIdentityUser(session.user)
  );
}

function loadStoredSession() {
  if (sessionLoaded) return currentSession;
  sessionLoaded = true;
  try {
    const stored = wx.getStorageSync(SESSION_STORAGE_KEY) as unknown;
    currentSession = isMiniIdentitySession(stored) ? stored : null;
  } catch {
    currentSession = null;
  }
  return currentSession;
}

function sessionIsUsable(session: MiniIdentitySession | null) {
  return Boolean(session && Date.parse(session.expiresAt) > Date.now() + EXPIRY_SKEW_MS);
}

export function getMiniSession() {
  const session = loadStoredSession();
  if (sessionIsUsable(session)) return session;
  if (session) clearMiniSession(session.token);
  return null;
}

export function saveMiniSession(session: MiniIdentitySession) {
  currentSession = session;
  sessionLoaded = true;
  try {
    wx.setStorageSync(SESSION_STORAGE_KEY, session);
  } catch {
    // 存储不可用时仍保留内存中的会话，只是下次启动需要重新登录。
  }
}

export function updateMiniSessionUser(user: MiniIdentityUser) {
  const session = getMiniSession();
  if (!session) return;
  saveMiniSession({ ...session, user });
}

export function clearMiniSession(expectedToken?: string) {
  const session = loadStoredSession();
  if (expectedToken && session?.token !== expectedToken) return;
  currentSession = null;
  sessionLoaded = true;
  try {
    wx.removeStorageSync(SESSION_STORAGE_KEY);
  } catch {
    // The in-memory session is still cleared even if storage is unavailable.
  }
}

function getWechatLoginCode() {
  return new Promise<string>((resolve, reject) => {
    wx.login({
      timeout: 10_000,
      success(result) {
        if (result.code) {
          resolve(result.code);
          return;
        }
        reject(new PublicApiError("微信登录失败，请稍后重试。"));
      },
      fail(error) {
        reject(transportError(error.errMsg, "微信登录失败，请稍后重试。"));
      },
    });
  });
}

async function signInWithWechat() {
  const code = await getWechatLoginCode();
  const session = await requestApi<MiniIdentitySession>("/mini/auth/wechat", {
    method: "POST",
    data: { code },
  });
  saveMiniSession(session);
  return session;
}

export function ensureMiniSession(force = false): Promise<MiniIdentitySession> {
  const existing = getMiniSession();
  if (!force && existing) return Promise.resolve(existing);
  if (signInPromise) return signInPromise;
  if (force && existing) clearMiniSession(existing.token);

  signInPromise = signInWithWechat().finally(() => {
    signInPromise = null;
  });
  return signInPromise;
}

async function renewRejectedSession(rejectedToken: string) {
  const latest = getMiniSession();
  if (latest && latest.token !== rejectedToken) return latest;
  clearMiniSession(rejectedToken);
  return ensureMiniSession(true);
}

export async function authenticatedRequest<T>(
  path: string,
  options: Omit<ApiRequestOptions, "token"> = {},
) {
  const session = await ensureMiniSession();
  try {
    return await requestApi<T>(path, { ...options, token: session.token });
  } catch (error) {
    if (!(error instanceof PublicApiError) || error.statusCode !== 401) throw error;
    const renewed = await renewRejectedSession(session.token);
    return requestApi<T>(path, { ...options, token: renewed.token });
  }
}

export async function authenticatedUpload<T>(path: string, filePath: string) {
  const session = await ensureMiniSession();
  try {
    return await uploadApiFile<T>(path, filePath, session.token);
  } catch (error) {
    if (!(error instanceof PublicApiError) || error.statusCode !== 401) throw error;
    const renewed = await renewRejectedSession(session.token);
    return uploadApiFile<T>(path, filePath, renewed.token);
  }
}
