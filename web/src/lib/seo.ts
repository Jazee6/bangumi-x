import {
  CANONICAL_WEB_ORIGIN,
  COLLECTION_PAGE_SIZE,
  PUBLICATION,
  SEASON_LABELS,
  getRobotsDirective,
  type CharacterDetail,
  type CharacterType,
  type ChapterDetail,
  type ChapterSubject,
  type PersonDetail,
  type PersonType,
  type PublicationDecision,
  type PublicCollectionListItem,
  type RelatedSubjectsResponse,
  type Season,
  type SubjectCharactersResponse,
  type SubjectDetail,
  type SubjectPersonsResponse,
  type SubjectType,
} from "share";

const SITE_NAME = "Bangumi X";
const DEFAULT_DESCRIPTION =
  "Bangumi X 提供每日放送、本年度热门、排行榜与条目资料，并支持个人收藏和进度管理。";

export interface PageMetadataInput {
  title?: string;
  description?: string;
  canonicalPath?: string;
  publication?: PublicationDecision;
  /** 分享图绝对地址；省略时使用品牌图，null 时不输出社交元数据。 */
  image?: string | null;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
}

function absoluteWebUrl(path = "/") {
  return new URL(path, CANONICAL_WEB_ORIGIN).toString();
}

// 分享图不在服务端渲染（免费版 Worker 的 CPU 预算不够），详情页用封面，其余用静态品牌图。
const BRAND_IMAGE = absoluteWebUrl("/og-brand.png");

export function coverShareImage(imageUrl: string | null | undefined, nsfw = false) {
  return !nsfw && imageUrl ? imageUrl : undefined;
}

export function buildPageHead({
  title,
  description = DEFAULT_DESCRIPTION,
  canonicalPath = "/",
  publication = PUBLICATION.index("public-page"),
  image,
  jsonLd,
}: PageMetadataInput = {}) {
  const isRestricted =
    publication.state === "not-found" || publication.state === "noindex-nofollow";
  const fullTitle = title
    ? `${title} - ${SITE_NAME}`
    : publication.state === "not-found"
      ? `页面不存在 - ${SITE_NAME}`
      : SITE_NAME;
  const canonical = absoluteWebUrl(canonicalPath);
  const meta: Array<Record<string, unknown>> = [
    { title: fullTitle },
    { name: "description", content: description },
    { name: "robots", content: getRobotsDirective(publication) },
  ];
  if (isRestricted) return { meta, links: [] };
  if (image !== null) {
    const isBrand = image === undefined;
    const imageUrl = image ?? BRAND_IMAGE;
    meta.push(
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: SITE_NAME },
      { property: "og:locale", content: "zh_CN" },
      { property: "og:title", content: fullTitle },
      { property: "og:description", content: description },
      { property: "og:url", content: canonical },
      { property: "og:image", content: imageUrl },
      ...(isBrand
        ? [
            { property: "og:image:width", content: "1200" },
            { property: "og:image:height", content: "630" },
          ]
        : []),
      // 封面是竖图，用小卡片避免被裁成横幅。
      { name: "twitter:card", content: isBrand ? "summary_large_image" : "summary" },
      { name: "twitter:title", content: fullTitle },
      { name: "twitter:description", content: description },
      { name: "twitter:image", content: imageUrl },
    );
  }
  if (jsonLd) {
    for (const value of Array.isArray(jsonLd) ? jsonLd : [jsonLd]) {
      meta.push({ "script:ld+json": value });
    }
  }
  return { meta, links: [{ rel: "canonical", href: canonical }] };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${CANONICAL_WEB_ORIGIN}/#website`,
    name: SITE_NAME,
    url: absoluteWebUrl(),
    inLanguage: "zh-CN",
    creator: {
      "@type": "Person",
      name: "Jazee6",
      sameAs: "https://github.com/Jazee6",
    },
    sameAs: "https://github.com/Jazee6/bangumi-x",
  };
}

export interface BreadcrumbItem {
  name: string;
  path: string;
}

export function buildBreadcrumbJsonLd(items: readonly BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteWebUrl(item.path),
    })),
  };
}

export function getSubjectBreadcrumbs(
  subject: { id: number; title: string },
  subroute?: "characters" | "persons",
): BreadcrumbItem[] {
  const items: BreadcrumbItem[] = [
    { name: "首页", path: "/" },
    { name: subject.title, path: `/subjects/${subject.id}` },
  ];
  if (subroute === "characters") {
    items.push({ name: "角色", path: `/subjects/${subject.id}/characters` });
  } else if (subroute === "persons") {
    items.push({ name: "人物", path: `/subjects/${subject.id}/persons` });
  }
  return items;
}

export function getEntityBreadcrumbs(
  kind: "角色" | "人物",
  entity: { id: number; name: string },
): BreadcrumbItem[] {
  const path = kind === "角色" ? `/characters/${entity.id}` : `/persons/${entity.id}`;
  return [
    { name: "首页", path: "/" },
    { name: entity.name, path },
  ];
}

export function getChapterBreadcrumbs(
  chapter: { id: number; title: string },
  subject: { id: number; title: string },
): BreadcrumbItem[] {
  return [
    { name: "首页", path: "/" },
    { name: subject.title, path: `/subjects/${subject.id}` },
    { name: chapter.title, path: `/chapters/${chapter.id}` },
  ];
}

export function getRankingsBreadcrumbs(year: number, season: Season): BreadcrumbItem[] {
  const seasonLabel = SEASON_LABELS[season] ?? season;
  return [
    { name: "首页", path: "/" },
    { name: `${year} 年${seasonLabel}排行榜`, path: `/rankings/${year}/${season}` },
  ];
}

export function buildItemListJsonLd(
  items: readonly { id: number; title: string; imageUrl?: string | null }[],
) {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: absoluteWebUrl(`/subjects/${item.id}`),
      name: item.title,
      ...(item.imageUrl ? { image: item.imageUrl } : {}),
    })),
  };
}

export function getSubjectSchemaType(type: SubjectType): string {
  switch (type) {
    case "动画":
    case "三次元":
      return "TVSeries";
    case "书籍":
      return "Book";
    case "游戏":
      return "VideoGame";
    case "音乐":
      return "MusicAlbum";
    default:
      return "CreativeWork";
  }
}

export function buildSubjectJsonLd(subject: SubjectDetail) {
  const schemaType = getSubjectSchemaType(subject.type);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": schemaType,
    "@id": `${CANONICAL_WEB_ORIGIN}/subjects/${subject.id}`,
    name: subject.title,
    url: `${CANONICAL_WEB_ORIGIN}/subjects/${subject.id}`,
    sameAs: `https://bgm.tv/subject/${subject.id}`,
    isBasedOn: `https://bgm.tv/subject/${subject.id}`,
  };
  if (subject.imageUrl) {
    jsonLd.image = subject.imageUrl;
  }
  if (subject.date) {
    jsonLd.datePublished = subject.date;
  }
  if (subject.summary) {
    jsonLd.description = subject.summary;
  }
  if (
    subject.score !== null &&
    typeof subject.score === "number" &&
    Number.isFinite(subject.score) &&
    subject.score > 0 &&
    subject.scoreCount !== null &&
    typeof subject.scoreCount === "number" &&
    subject.scoreCount > 0
  ) {
    jsonLd.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: subject.score,
      bestRating: 10,
      worstRating: 1,
      ratingCount: subject.scoreCount,
    };
  }
  return jsonLd;
}

function getChapterSchemaType(subjectType: SubjectType): "TVEpisode" | "CreativeWork" {
  return subjectType === "动画" || subjectType === "三次元" ? "TVEpisode" : "CreativeWork";
}

export function buildChapterJsonLd(chapter: ChapterDetail, subject: ChapterSubject) {
  const parentSchemaType = getSubjectSchemaType(subject.type);
  const chapterSchemaType = getChapterSchemaType(subject.type);
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": chapterSchemaType,
    "@id": `${CANONICAL_WEB_ORIGIN}/chapters/${chapter.id}`,
    name: chapter.title,
    url: `${CANONICAL_WEB_ORIGIN}/chapters/${chapter.id}`,
    sameAs: `https://bgm.tv/ep/${chapter.id}`,
    isBasedOn: `https://bgm.tv/ep/${chapter.id}`,
    isPartOf: {
      "@type": parentSchemaType,
      name: subject.title,
      url: `${CANONICAL_WEB_ORIGIN}/subjects/${subject.id}`,
    },
  };
  if (chapter.sequence !== null) {
    jsonLd.position = chapter.sequence;
  }
  if (chapter.date) {
    jsonLd.datePublished = chapter.date;
  }
  if (chapter.summary) {
    jsonLd.description = chapter.summary;
  }
  return jsonLd;
}

export function getCharacterSchemaType(type: CharacterType): string {
  switch (type) {
    case "角色":
      return "Person";
    case "组织":
      return "Organization";
    default:
      return "Thing";
  }
}

export function getPersonSchemaType(type: PersonType): string {
  switch (type) {
    case "个人":
      return "Person";
    case "公司":
    case "组合":
      return "Organization";
    default:
      return "Person";
  }
}

export function buildCharacterJsonLd(
  character: CharacterDetail,
  subjects: RelatedSubjectsResponse,
) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": getCharacterSchemaType(character.type),
    "@id": `${CANONICAL_WEB_ORIGIN}/characters/${character.id}`,
    name: character.name,
    url: `${CANONICAL_WEB_ORIGIN}/characters/${character.id}`,
    sameAs: `https://bgm.tv/character/${character.id}`,
    isBasedOn: `https://bgm.tv/character/${character.id}`,
  };
  if (character.type === "角色") jsonLd.disambiguatingDescription = "虚构角色";
  if (character.imageUrl) jsonLd.image = character.imageUrl;
  if (character.summary) jsonLd.description = character.summary;
  if (character.gender) jsonLd.gender = character.gender;
  if (character.birthday) jsonLd.birthDate = character.birthday;
  if (subjects.total > 0) {
    jsonLd.subjectOf = subjects.groups.flatMap((group) =>
      group.items.map((subject) => ({
        "@type": getSubjectSchemaType(subject.type),
        name: subject.title,
        url: `${CANONICAL_WEB_ORIGIN}/subjects/${subject.id}`,
      })),
    );
  }
  return jsonLd;
}

export function buildPersonJsonLd(person: PersonDetail, subjects: RelatedSubjectsResponse) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": getPersonSchemaType(person.type),
    "@id": `${CANONICAL_WEB_ORIGIN}/persons/${person.id}`,
    name: person.name,
    url: `${CANONICAL_WEB_ORIGIN}/persons/${person.id}`,
    sameAs: `https://bgm.tv/person/${person.id}`,
    isBasedOn: `https://bgm.tv/person/${person.id}`,
  };
  if (person.imageUrl) jsonLd.image = person.imageUrl;
  if (person.summary) jsonLd.description = person.summary;
  if (person.type === "个人" && person.gender) jsonLd.gender = person.gender;
  if (person.type === "个人" && person.birthday) jsonLd.birthDate = person.birthday;
  if (person.careers.length > 0) jsonLd.jobTitle = person.careers;
  if (subjects.total > 0) {
    jsonLd.subjectOf = subjects.groups.flatMap((group) =>
      group.items.map((subject) => ({
        "@type": getSubjectSchemaType(subject.type),
        name: subject.title,
        url: `${CANONICAL_WEB_ORIGIN}/subjects/${subject.id}`,
      })),
    );
  }
  return jsonLd;
}

export function buildPublicCollectionListJsonLd(options: {
  name: string;
  shareId: string;
  page: number;
  total: number;
  updatedAt: string;
  items: readonly PublicCollectionListItem[];
}) {
  const canonicalPath = `/s/${options.shareId}${options.page > 1 ? `?page=${options.page}` : ""}`;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${options.name}${options.page > 1 ? `（第 ${options.page} 页）` : ""}`,
    url: absoluteWebUrl(canonicalPath),
    numberOfItems: options.total,
    dateModified: options.updatedAt,
    itemListElement: options.items.map((item, index) => ({
      "@type": "ListItem",
      position: (options.page - 1) * COLLECTION_PAGE_SIZE + index + 1,
      name: item.title,
      url: absoluteWebUrl(`/subjects/${item.id}`),
      ...(item.imageUrl ? { image: item.imageUrl } : {}),
    })),
  };
}

export function buildSubjectChaptersJsonLd(
  subject: SubjectDetail,
  chapters: readonly { id: number; title: string }[],
  page = 1,
) {
  const canonicalUrl = `${CANONICAL_WEB_ORIGIN}/subjects/${subject.id}${page > 1 ? `?page=${page}` : ""}`;
  const chapterType = getChapterSchemaType(subject.type);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${subject.title} 的章节列表${page > 1 ? `（第 ${page} 页）` : ""}`,
    url: canonicalUrl,
    sameAs: `https://bgm.tv/subject/${subject.id}/ep`,
    isBasedOn: `https://bgm.tv/subject/${subject.id}/ep`,
    itemListElement: chapters.map((ep, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": chapterType,
        name: ep.title,
        url: `${CANONICAL_WEB_ORIGIN}/chapters/${ep.id}`,
        sameAs: `https://bgm.tv/ep/${ep.id}`,
      },
    })),
  };
}

export function buildSubjectCharactersJsonLd(
  subject: SubjectDetail,
  characters: SubjectCharactersResponse,
) {
  const allCharacters = characters.groups.flatMap((g) => g.items);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${subject.title} 的角色列表`,
    url: `${CANONICAL_WEB_ORIGIN}/subjects/${subject.id}/characters`,
    sameAs: `https://bgm.tv/subject/${subject.id}/characters`,
    isBasedOn: `https://bgm.tv/subject/${subject.id}/characters`,
    itemListElement: allCharacters.map((char, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": getCharacterSchemaType(char.type),
        name: char.name,
        url: `${CANONICAL_WEB_ORIGIN}/characters/${char.id}`,
        sameAs: `https://bgm.tv/character/${char.id}`,
        ...(char.imageUrl ? { image: char.imageUrl } : {}),
      },
    })),
  };
}

export function buildSubjectPersonsJsonLd(subject: SubjectDetail, persons: SubjectPersonsResponse) {
  const allPersons = persons.groups.flatMap((g) => g.items);
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${subject.title} 的制作与演出人员`,
    url: `${CANONICAL_WEB_ORIGIN}/subjects/${subject.id}/persons`,
    sameAs: `https://bgm.tv/subject/${subject.id}/persons`,
    isBasedOn: `https://bgm.tv/subject/${subject.id}/persons`,
    itemListElement: allPersons.map((person, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": getPersonSchemaType(person.type),
        name: person.name,
        url: `${CANONICAL_WEB_ORIGIN}/persons/${person.id}`,
        sameAs: `https://bgm.tv/person/${person.id}`,
        ...(person.imageUrl ? { image: person.imageUrl } : {}),
      },
    })),
  };
}

export const CACHE_CONTROL = {
  // 可索引的详情页与每日放送。
  detail: "public, max-age=3600, stale-while-revalidate=86400",
  // 暂不索引的薄内容页，缩短缓存以便内容补全后尽快更新。
  thin: "public, max-age=600, stale-while-revalidate=3600",
  // 目录、站点地图等变化缓慢的页面。
  directory: "public, max-age=86400, stale-while-revalidate=604800",
} as const;

export const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};

export const NOT_FOUND_HEADERS = {
  "Cache-Control": "no-store, max-age=0",
  "X-Robots-Tag": "noindex, nofollow",
};
