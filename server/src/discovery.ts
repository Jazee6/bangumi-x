import type {
  DiscoveryCharacterSummary,
  DiscoveryPersonSummary,
  SubjectSummary,
  SubjectType,
  SubjectTypeFilter,
} from "share";

import { getCareers, getCharacterType, getPersonType } from "./entity";
import { getProxiedEntityImageUrl } from "./poster";
import { getOptionalString, isPositiveInteger, isRecord } from "./validation";

export const SUBJECT_TYPE_FILTERS: Record<
  SubjectTypeFilter,
  { upstream: number; label: Exclude<SubjectType, "其他"> }
> = {
  book: { upstream: 1, label: "书籍" },
  anime: { upstream: 2, label: "动画" },
  music: { upstream: 3, label: "音乐" },
  game: { upstream: 4, label: "游戏" },
  real: { upstream: 6, label: "三次元" },
};

export interface PopularSubjectBatch {
  total: number | null;
  rawCount: number;
  data: SubjectSummary[];
}

function getScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizeSubjectBatch(
  value: unknown,
  type: SubjectTypeFilter,
  workerOrigin: string,
  requireRank: boolean,
): PopularSubjectBatch {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new TypeError("Subject page response must contain a data array");
  }

  const total =
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0
      ? value.total
      : null;
  const rawCount = value.data.length;
  const subjectType = SUBJECT_TYPE_FILTERS[type];
  const data = value.data.flatMap((subject): SubjectSummary[] => {
    if (
      !isRecord(subject) ||
      !isPositiveInteger(subject.id) ||
      subject.type !== subjectType.upstream ||
      subject.nsfw === true
    ) {
      return [];
    }

    const rating = isRecord(subject.rating) ? subject.rating : null;
    const rank = isPositiveInteger(rating?.rank) ? rating.rank : null;
    if (requireRank && rank === null) return [];

    return [
      {
        id: subject.id,
        title:
          getOptionalString(subject.name_cn) ?? getOptionalString(subject.name) ?? "未命名条目",
        type: subjectType.label,
        imageUrl: getProxiedEntityImageUrl(subject.images, workerOrigin, "large"),
        score: getScore(rating?.score),
        rank,
        nsfw: false,
      },
    ];
  });

  return { total, rawCount, data };
}

export function normalizePopularSubjectBatch(
  value: unknown,
  type: SubjectTypeFilter,
  workerOrigin: string,
): PopularSubjectBatch {
  return normalizeSubjectBatch(value, type, workerOrigin, true);
}

export function normalizeSubjectSearchBatch(
  value: unknown,
  type: SubjectTypeFilter,
  workerOrigin: string,
): PopularSubjectBatch {
  return normalizeSubjectBatch(value, type, workerOrigin, false);
}

export interface SearchBatch<T> {
  total: number | null;
  rawCount: number;
  data: T[];
}

function normalizeSearchBatch<T>(
  value: unknown,
  normalizeItem: (item: unknown) => T | null,
): SearchBatch<T> {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new TypeError("Search response must contain a data array");
  }
  const total =
    typeof value.total === "number" && Number.isSafeInteger(value.total) && value.total >= 0
      ? value.total
      : null;
  return {
    total,
    rawCount: value.data.length,
    data: value.data.flatMap((item) => {
      const normalized = normalizeItem(item);
      return normalized ? [normalized] : [];
    }),
  };
}

export function normalizeCharacterSearchBatch(
  value: unknown,
  workerOrigin: string,
): SearchBatch<DiscoveryCharacterSummary> {
  return normalizeSearchBatch(value, (item) => {
    if (!isRecord(item) || !isPositiveInteger(item.id) || item.nsfw === true) return null;
    const type = getCharacterType(item.type);
    if (!type) return null;
    return {
      id: item.id,
      name: getOptionalString(item.name) ?? "未命名角色",
      type,
      imageUrl: getProxiedEntityImageUrl(item.images, workerOrigin),
      summary: getOptionalString(item.summary),
    };
  });
}

export function normalizePersonSearchBatch(
  value: unknown,
  workerOrigin: string,
): SearchBatch<DiscoveryPersonSummary> {
  return normalizeSearchBatch(value, (item) => {
    if (!isRecord(item) || !isPositiveInteger(item.id) || item.nsfw === true) return null;
    const type = getPersonType(item.type);
    if (!type) return null;
    return {
      id: item.id,
      name: getOptionalString(item.name) ?? "未命名人物",
      type,
      careers: getCareers(item.career),
      imageUrl: getProxiedEntityImageUrl(item.images, workerOrigin),
      summary: getOptionalString(item.short_summary) ?? getOptionalString(item.summary),
    };
  });
}
