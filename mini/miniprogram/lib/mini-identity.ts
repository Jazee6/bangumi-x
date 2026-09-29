import type {
  MiniAccountLinkClaim,
  MiniAccountLinkPreview,
  MiniAccountLinkResult,
  MiniIdentityUser,
} from "share";

import {
  authenticatedRequest,
  authenticatedUpload,
  getMiniSession,
  saveMiniSession,
  updateMiniSessionUser,
} from "./mini-auth";
import { PublicApiError, requestApi } from "./request";
import { markPersonalRecordsChanged } from "./personal-records";

const PENDING_LINK_STORAGE_KEY = "bangumi-x-mini-account-link-v1";

interface PendingAccountLink {
  claimToken: string;
  expiresAt: string;
}

function isPendingAccountLink(value: unknown): value is PendingAccountLink {
  if (!value || typeof value !== "object") return false;
  const pending = value as Partial<PendingAccountLink>;
  return (
    typeof pending.claimToken === "string" &&
    Boolean(pending.claimToken) &&
    typeof pending.expiresAt === "string" &&
    Number.isFinite(Date.parse(pending.expiresAt))
  );
}

export function getUserInitial(name: string) {
  return Array.from(name.trim())[0] ?? "番";
}

export async function getMiniIdentity() {
  const response = await authenticatedRequest<{ user: MiniIdentityUser }>("/mini/me");
  updateMiniSessionUser(response.user);
  return response.user;
}

export async function updateMiniDisplayName(name: string) {
  const response = await authenticatedRequest<{ user: MiniIdentityUser }>("/mini/me/display-name", {
    method: "POST",
    data: { name },
  });
  updateMiniSessionUser(response.user);
  return response.user;
}

export async function uploadMiniAvatar(filePath: string) {
  const response = await authenticatedUpload<{ user: MiniIdentityUser }>(
    "/mini/me/avatar",
    filePath,
  );
  updateMiniSessionUser(response.user);
  return response.user;
}

export async function claimMiniAccountLink(credential: string) {
  const claim = await authenticatedRequest<MiniAccountLinkClaim>("/mini/account-links/claim", {
    method: "POST",
    data: { credential },
  });
  savePendingAccountLink({
    claimToken: claim.claimToken,
    expiresAt: claim.preview.expiresAt,
  });
  return claim;
}

export function getPendingAccountLink() {
  try {
    const value = wx.getStorageSync(PENDING_LINK_STORAGE_KEY) as unknown;
    if (!isPendingAccountLink(value)) return null;
    if (Date.parse(value.expiresAt) <= Date.now()) {
      clearPendingAccountLink();
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export function savePendingAccountLink(link: PendingAccountLink) {
  wx.setStorageSync(PENDING_LINK_STORAGE_KEY, link);
}

export function clearPendingAccountLink() {
  try {
    wx.removeStorageSync(PENDING_LINK_STORAGE_KEY);
  } catch {
    // An expired pairing can safely be ignored even if storage cleanup fails.
  }
}

export function getMiniAccountLinkPreview(claimToken: string) {
  return authenticatedRequest<MiniAccountLinkPreview>(
    `/mini/account-links/${encodeURIComponent(claimToken)}`,
  );
}

export function confirmMiniAccountLink(claimToken: string, previewVersion: string) {
  return authenticatedRequest<MiniAccountLinkResult>(
    `/mini/account-links/${encodeURIComponent(claimToken)}/confirm`,
    {
      method: "POST",
      data: { previewVersion },
    },
  );
}

export async function cancelMiniAccountLink(claimToken: string) {
  await authenticatedRequest<void>(`/mini/account-links/${encodeURIComponent(claimToken)}/cancel`, {
    method: "POST",
  });
  clearPendingAccountLink();
}

export function getMiniAccountLinkResult(claimToken: string) {
  return requestApi<MiniAccountLinkResult>(
    `/mini/account-links/${encodeURIComponent(claimToken)}/result`,
  );
}

async function acknowledgeMiniAccountLinkResult(claimToken: string) {
  await requestApi<void>(`/mini/account-links/${encodeURIComponent(claimToken)}/result/ack`, {
    method: "POST",
  });
}

export async function finishMiniAccountLink(claimToken: string) {
  const result = await getMiniAccountLinkResult(claimToken);
  if (result.state !== "complete") return result;

  if (result.sessionToken && result.expiresAt && result.user) {
    saveMiniSession({
      token: result.sessionToken,
      expiresAt: result.expiresAt,
      user: result.user,
    });
  } else if (result.sessionToken || !getMiniSession()) {
    throw new PublicApiError("用户合并后的会话恢复失败，请重试。");
  }
  await acknowledgeMiniAccountLinkResult(claimToken);
  clearPendingAccountLink();
  // 合并后当前用户的个人数据来自目标用户，所有个人列表都需要刷新。
  markPersonalRecordsChanged();
  return result;
}

export function isAccountLinkRecoverableError(error: unknown) {
  return (
    error instanceof PublicApiError &&
    (error.code === "MINI_ACCOUNT_LINK_CONFLICT" || error.code === "UNAUTHORIZED")
  );
}
