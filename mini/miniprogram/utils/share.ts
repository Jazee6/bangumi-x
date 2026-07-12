import { proxyImageUrl } from "./request";
import { SubjectTypeLabel, type Character, type PersonDetail, type Subject } from "../types";

const BRAND = "Bangumi X";
const MAX_TITLE_LEN = 35;

interface SharePayload {
  title: string;
  path: string;
  imageUrl?: string;
}

function truncate(title: string): string {
  return title.length > MAX_TITLE_LEN ? `${title.slice(0, MAX_TITLE_LEN - 1)}…` : title;
}

function detailTitle(name: string, type: string): string {
  return truncate(`${name}｜${type}｜${BRAND}`);
}

export function getSubjectTitle(subject: Subject): string {
  const primaryName = subject.name_cn || subject.name;
  const name = subject.name_cn && subject.name !== subject.name_cn ? `${primaryName}（${subject.name}）` : primaryName;
  return detailTitle(name, SubjectTypeLabel[subject.type] ?? "条目");
}

export function getCharacterTitle(character: Character): string {
  return detailTitle(character.name, "角色");
}

export function getPersonTitle(person: PersonDetail): string {
  return detailTitle(person.name, "人物");
}

function detailPath(type: "subject" | "character" | "person", id: number): string {
  return `/pages/${type}/${type}?id=${encodeURIComponent(id)}`;
}

export function buildSubjectShare(subject: Subject): SharePayload {
  const image = subject.images?.large || subject.images?.common;
  return {
    title: getSubjectTitle(subject),
    path: detailPath("subject", subject.id),
    imageUrl: image ? proxyImageUrl(image) : undefined,
  };
}

export function buildCharacterShare(character: Character): SharePayload {
  const image = character.images?.large || character.images?.medium;
  return {
    title: getCharacterTitle(character),
    path: detailPath("character", character.id),
    imageUrl: image ? proxyImageUrl(image) : undefined,
  };
}

export function buildPersonShare(person: PersonDetail): SharePayload {
  const image = person.images?.large || person.images?.medium;
  return {
    title: getPersonTitle(person),
    path: detailPath("person", person.id),
    imageUrl: image ? proxyImageUrl(image) : undefined,
  };
}

const BRAND_TITLES: Record<"index" | "discover" | "profile", string> = {
  index: `每日放送｜${BRAND}`,
  discover: `番组、角色与人物搜索｜${BRAND}`,
  profile: `${BRAND} · 我的`,
};

const BRAND_PATHS: Record<"index" | "discover" | "profile", string> = {
  index: "/pages/index/index",
  discover: "/pages/discover/discover",
  profile: "/pages/profile/profile",
};

export function buildBrandShare(page: "index" | "discover" | "profile"): SharePayload {
  return {
    title: BRAND_TITLES[page],
    path: BRAND_PATHS[page],
  };
}
