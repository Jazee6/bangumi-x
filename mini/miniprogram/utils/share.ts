import { proxyImageUrl } from "./request";
import type { Character, PersonDetail, Subject } from "../types";

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

function detailPath(type: "subject" | "character" | "person", id: number): string {
  return `/pages/${type}/${type}?id=${encodeURIComponent(id)}`;
}

export function buildSubjectShare(subject: Subject): SharePayload {
  const name = subject.name_cn || subject.name;
  const image = subject.images?.large || subject.images?.common;
  return {
    title: truncate(`${name} · ${BRAND}`),
    path: detailPath("subject", subject.id),
    imageUrl: image ? proxyImageUrl(image) : undefined,
  };
}

export function buildCharacterShare(character: Character): SharePayload {
  const image = character.images?.large || character.images?.medium;
  return {
    title: truncate(`${character.name} · ${BRAND}`),
    path: detailPath("character", character.id),
    imageUrl: image ? proxyImageUrl(image) : undefined,
  };
}

export function buildPersonShare(person: PersonDetail): SharePayload {
  const image = person.images?.large || person.images?.medium;
  return {
    title: truncate(`${person.name} · ${BRAND}`),
    path: detailPath("person", person.id),
    imageUrl: image ? proxyImageUrl(image) : undefined,
  };
}

const BRAND_TITLES: Record<"index" | "discover" | "profile", string> = {
  index: `${BRAND} · 每日放送`,
  discover: `${BRAND} · 发现`,
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
