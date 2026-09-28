import type { CharacterType, PersonType, SubjectType } from "share";

import { getOptionalString, isPositiveInteger, isRecord } from "./validation";

const PERSON_TYPES: Record<number, PersonType> = {
  1: "个人",
  2: "公司",
  3: "组合",
};

const CHARACTER_TYPES: Record<number, CharacterType> = {
  1: "角色",
  2: "机体",
  3: "舰船",
  4: "组织",
};

const SUBJECT_TYPES: Record<number, SubjectType> = {
  1: "书籍",
  2: "动画",
  3: "音乐",
  4: "游戏",
  6: "三次元",
};

const CAREER_LABELS: Record<string, string> = {
  producer: "制作人",
  mangaka: "漫画家",
  artist: "艺术家",
  seiyu: "声优",
  writer: "作家",
  illustrator: "插画家",
  actor: "演员",
};

const BLOOD_TYPES: Record<number, string> = {
  1: "A型",
  2: "B型",
  3: "AB型",
  4: "O型",
};

export function getPersonType(value: unknown): PersonType | null {
  return typeof value === "number" ? (PERSON_TYPES[value] ?? null) : null;
}

export function getCharacterType(value: unknown): CharacterType | null {
  return typeof value === "number" ? (CHARACTER_TYPES[value] ?? null) : null;
}

export function getSubjectType(value: unknown): SubjectType {
  return typeof value === "number" ? (SUBJECT_TYPES[value] ?? "其他") : "其他";
}

export function getCareers(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value.flatMap((career) => {
    const normalized = getOptionalString(career);
    if (!normalized) {
      return [];
    }
    const label = CAREER_LABELS[normalized] ?? normalized;
    if (seen.has(label)) {
      return [];
    }
    seen.add(label);
    return [label];
  });
}

export function getGender(value: unknown): string | null {
  const gender = getOptionalString(value);
  if (!gender) {
    return null;
  }
  if (gender.toLowerCase() === "male") {
    return "男";
  }
  if (gender.toLowerCase() === "female") {
    return "女";
  }
  return gender;
}

export function getBloodType(value: unknown): string | null {
  return typeof value === "number" ? (BLOOD_TYPES[value] ?? null) : null;
}

function getIntegerInRange(value: unknown, minimum: number, maximum: number): number | null {
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= minimum &&
    value <= maximum
    ? value
    : null;
}

export function getBirthday(value: unknown): string | null {
  if (!isRecord(value)) {
    return null;
  }

  const year = isPositiveInteger(value.birth_year) ? value.birth_year : null;
  const month = getIntegerInRange(value.birth_mon, 1, 12);
  const day = getIntegerInRange(value.birth_day, 1, 31);

  if (year && month && day) {
    return `${year}年${month}月${day}日`;
  }
  if (year && month) {
    return `${year}年${month}月`;
  }
  if (year) {
    return `${year}年`;
  }
  if (month && day) {
    return `${month}月${day}日`;
  }
  if (month) {
    return `${month}月`;
  }
  return null;
}

export function getRelation(value: unknown): string {
  return getOptionalString(value) ?? "其他";
}

export function getSubjectTitle(value: unknown): string {
  if (!isRecord(value)) {
    return "未命名条目";
  }
  return getOptionalString(value.name_cn) ?? getOptionalString(value.name) ?? "未命名条目";
}
