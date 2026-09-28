import type { SubjectType } from "share";

import { parseAllowedPosterUrl } from "./poster";
import { getOptionalString, isPositiveInteger, isRecord } from "./validation";

const SUBJECT_TYPES: Record<number, Exclude<SubjectType, "其他">> = {
  1: "书籍",
  2: "动画",
  3: "音乐",
  4: "游戏",
  6: "三次元",
};
const POSTER_SIZES = ["large", "common", "medium", "small", "grid"] as const;

export function normalizeSubjectType(value: unknown): SubjectType {
  return typeof value === "number" ? (SUBJECT_TYPES[value] ?? "其他") : "其他";
}

export interface SubjectSnapshotInput {
  subjectId: number;
  title: string;
  type: SubjectType;
  posterSourceUrl: string | null;
  nsfw: boolean;
  totalChapters: number | null;
}

export function normalizeSubjectSnapshot(value: unknown): SubjectSnapshotInput {
  if (!isRecord(value) || !isPositiveInteger(value.id)) {
    throw new TypeError("Subject snapshot must have a positive integer ID");
  }
  const type = normalizeSubjectType(value.type);

  const images = isRecord(value.images) ? value.images : {};
  const posterSourceUrl =
    POSTER_SIZES.map((size) => parseAllowedPosterUrl(images[size]))
      .find((url) => url !== null)
      ?.toString() ?? null;

  const rawTotal =
    typeof value.total_chapters === "number" &&
    Number.isSafeInteger(value.total_chapters) &&
    value.total_chapters > 0
      ? value.total_chapters
      : typeof value.eps === "number" && Number.isSafeInteger(value.eps) && value.eps > 0
        ? value.eps
        : null;

  return {
    subjectId: value.id,
    title: getOptionalString(value.name_cn) ?? getOptionalString(value.name) ?? "未命名条目",
    type,
    posterSourceUrl,
    nsfw: value.nsfw === true,
    totalChapters: rawTotal,
  };
}
