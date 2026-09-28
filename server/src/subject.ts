import type { SubjectDetail } from "share";

import { getProxiedEntityImageUrl } from "./poster";
import { normalizeSubjectType } from "./subject-snapshot";
import { getOptionalString, isPositiveInteger, isRecord } from "./validation";

function getNonNegativeInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : null;
}

function getScore(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function getTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((tag) => {
      const name = isRecord(tag) ? getOptionalString(tag.name) : null;
      return name ? [name] : [];
    })
    .slice(0, 10);
}

export function normalizeSubject(value: unknown, workerOrigin: string): SubjectDetail {
  if (!isRecord(value)) {
    throw new TypeError("Subject response must be an object");
  }

  if (!isPositiveInteger(value.id)) {
    throw new TypeError("Subject response must have a positive integer ID");
  }
  const id = value.id;

  const chineseTitle = getOptionalString(value.name_cn);
  const upstreamOriginalTitle = getOptionalString(value.name);
  const title = chineseTitle ?? upstreamOriginalTitle ?? "未命名条目";
  const originalTitle =
    upstreamOriginalTitle && upstreamOriginalTitle !== title ? upstreamOriginalTitle : null;
  const rating = isRecord(value.rating) ? value.rating : null;

  return {
    id,
    title,
    type: normalizeSubjectType(value.type),
    originalTitle,
    platform: getOptionalString(value.platform),
    date: getOptionalString(value.date),
    totalChapters: getNonNegativeInteger(value.total_chapters) ?? getNonNegativeInteger(value.eps),
    score: getScore(rating?.score),
    rank: isPositiveInteger(rating?.rank) ? rating.rank : null,
    scoreCount: isPositiveInteger(rating?.total) ? rating.total : null,
    nsfw: value.nsfw === true,
    summary: getOptionalString(value.summary),
    tags: getTags(value.tags),
    imageUrl: getProxiedEntityImageUrl(value.images, workerOrigin, "large"),
    broadcast: null,
  };
}
