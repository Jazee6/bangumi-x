import type { MiniContentPolicy } from "share";

import { publicPageCache } from "./memory-cache";
import { requestJson } from "./request";

// 名单由 Server 下发，调整后无需发版。取不到时沿用上次成功取到的名单。
const STORAGE_KEY = "contentPolicy";
const STALE_TIME = 5 * 60 * 1_000;

export interface ContentPolicy {
  /** 详情页按 NSFW 处理：显示内容不可访问。 */
  isBlockedSubject(subject: { id: number; nsfw: boolean }): boolean;
  /** 列表中直接移除。 */
  withoutBlockedSubjects<T extends { id: number }>(subjects: T[]): T[];
  /** 移除后变空的分组一并移除。 */
  withoutBlockedGroups<T extends { id: number }, G extends { items: T[] }>(groups: G[]): G[];
}

export function createContentPolicy(blockedSubjectIds: Iterable<number>): ContentPolicy {
  const blocked = new Set(blockedSubjectIds);
  const withoutBlockedSubjects = <T extends { id: number }>(subjects: T[]) =>
    subjects.filter((subject) => !blocked.has(subject.id));
  return {
    isBlockedSubject: (subject) => subject.nsfw || blocked.has(subject.id),
    withoutBlockedSubjects,
    withoutBlockedGroups: (groups) =>
      groups
        .map((group) => ({ ...group, items: withoutBlockedSubjects(group.items) }))
        .filter((group) => group.items.length > 0),
  };
}

function readStoredIds(): number[] {
  try {
    const value = wx.getStorageSync(STORAGE_KEY) as unknown;
    return Array.isArray(value) ? value.filter((id): id is number => Number.isInteger(id)) : [];
  } catch {
    return [];
  }
}

export async function loadContentPolicy(): Promise<ContentPolicy> {
  try {
    const { blockedSubjectIds } = await publicPageCache.load(STORAGE_KEY, STALE_TIME, async () => {
      const policy = await requestJson<MiniContentPolicy>("/mini/content-policy");
      try {
        wx.setStorageSync(STORAGE_KEY, policy.blockedSubjectIds);
      } catch {
        // 写入失败只影响下次离线时的兜底。
      }
      return policy;
    });
    return createContentPolicy(blockedSubjectIds);
  } catch {
    return createContentPolicy(readStoredIds());
  }
}
