import type { ChapterPage, ChapterSummary, ChapterType } from "share";

import { getOptionalString, isPositiveInteger, isRecord } from "./validation";

const CHAPTER_TYPES: Record<number, ChapterType> = {
  0: "本篇",
  1: "特别篇",
  2: "OP",
  3: "ED",
  4: "PV",
  5: "MAD",
  6: "其他",
};

function getFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getNonNegativeIntegerOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizeChapter(value: unknown): ChapterSummary | null {
  if (!isRecord(value) || !isPositiveInteger(value.id)) {
    return null;
  }

  return {
    id: value.id,
    type:
      typeof value.type === "number" && Object.hasOwn(CHAPTER_TYPES, value.type)
        ? (CHAPTER_TYPES[value.type] ?? "其他")
        : "其他",
    sequence: getFiniteNumber(value.sort),
    title: getOptionalString(value.name_cn) ?? getOptionalString(value.name) ?? "未命名章节",
    date: getOptionalString(value.airdate),
    duration: getOptionalString(value.duration),
  };
}

export function normalizeChapterPage(
  value: unknown,
  requestedLimit: number,
  requestedOffset: number,
): ChapterPage {
  if (!isRecord(value) || !Array.isArray(value.data)) {
    throw new TypeError("Chapter page response must contain a data array");
  }

  return {
    total: getNonNegativeIntegerOr(value.total, 0),
    limit: requestedLimit,
    offset: requestedOffset,
    data: value.data.flatMap((chapter) => {
      const normalized = normalizeChapter(chapter);
      return normalized ? [normalized] : [];
    }),
  };
}

export interface NormalizedChapterDetail extends ChapterSummary {
  subjectId: number;
  summary: string | null;
}

export function normalizeChapterDetail(value: unknown): NormalizedChapterDetail {
  const chapter = normalizeChapter(value);
  if (!chapter || !isRecord(value) || !isPositiveInteger(value.subject_id)) {
    throw new TypeError("Chapter detail response must have valid identities");
  }

  return {
    ...chapter,
    subjectId: value.subject_id,
    summary: getOptionalString(value.desc),
  };
}
