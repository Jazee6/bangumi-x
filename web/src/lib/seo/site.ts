import type {
  Character,
  CharacterPerson,
  EpisodeDetail,
  PersonDetail,
  RelatedCharacter,
  RelatedPerson,
  Subject,
} from "@/types";
import { SubjectType, SubjectTypeLabel } from "@/types";

export const SITE_NAME = "Bangumi X";
export const SITE_DESCRIPTION = "Bangumi X - 番组计划数据浏览";
export const SITE_URL = "https://bgmx.jaze.top";
export const WORKER_URL = "https://s.bgmx.jaze.top";
export const GITHUB_URL = "https://github.com/Jazee6/bangumi-x";
const RATING_MIN_TOTAL = 10;

interface BuildMetaOpts {
  title: string;
  description?: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

function absUrl(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

function workerImage(src?: string): string | undefined {
  if (!src) return undefined;
  if (src.startsWith("http")) return src;
  return `${WORKER_URL}/bgm/image?url=${encodeURIComponent(src)}`;
}

function bgmSameAs(kind: "subject" | "character" | "person", id: number | string): string[] {
  return [`https://bgm.tv/${kind}/${id}`];
}

function subjectSchemaType(type: SubjectType): string {
  switch (type) {
    case SubjectType.Anime:
      return "TVSeries";
    case SubjectType.Book:
      return "Book";
    case SubjectType.Music:
      return "MusicAlbum";
    case SubjectType.Game:
      return "VideoGame";
    case SubjectType.Real:
      return "TVSeries";
    default:
      return "CreativeWork";
  }
}

function pruneFalsy(obj: Record<string, unknown>): void {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null || v === "" || v === 0) delete obj[k];
  }
}

function personRef(id: number, name: string): Record<string, unknown> {
  return {
    "@type": "Person",
    name,
    url: absUrl(`/persons/${id}`),
    sameAs: bgmSameAs("person", id),
  };
}

export function buildMeta(opts: BuildMetaOpts) {
  const title = `${opts.title} | ${SITE_NAME}`;
  const description = opts.description ?? SITE_DESCRIPTION;
  const ogImage = opts.image ? workerImage(opts.image) : absUrl("/og-default.png");
  const canonical = opts.url ? absUrl(opts.url) : undefined;

  const meta: Array<Record<string, string>> = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: opts.title },
    { property: "og:description", content: description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: opts.type ?? "website" },
    { property: "og:locale", content: "zh_CN" },
    { name: "twitter:card", content: ogImage ? "summary_large_image" : "summary" },
    { name: "twitter:title", content: opts.title },
    { name: "twitter:description", content: description },
  ];

  if (canonical) {
    meta.push({ property: "og:url", content: canonical });
  }
  if (ogImage) {
    meta.push({ property: "og:image", content: ogImage });
    meta.push({ name: "twitter:image", content: ogImage });
  }
  if (opts.noindex) {
    meta.push({ name: "robots", content: "noindex" });
  }

  const links: Array<Record<string, string>> = [];
  if (canonical) {
    links.push({ rel: "canonical", href: canonical });
  }

  const scripts: Array<Record<string, string>> = [];
  if (opts.jsonLd) {
    const arr = Array.isArray(opts.jsonLd) ? opts.jsonLd : [opts.jsonLd];
    for (const obj of arr) {
      scripts.push({ type: "application/ld+json", children: JSON.stringify(obj) });
    }
  }

  const result: { meta: typeof meta; links?: typeof links; scripts?: typeof scripts } = { meta };
  if (links.length) result.links = links;
  if (scripts.length) result.scripts = scripts;
  return result;
}

export function ogImageUrl(
  type: "subjects" | "characters" | "persons",
  id: number | string,
): string {
  return absUrl(`/og/${type}/${id}`);
}

export function subjectJsonLd(
  s: Subject,
  characters: RelatedCharacter[] = [],
  persons: RelatedPerson[] = [],
): Record<string, unknown> {
  const url = absUrl(`/subjects/${s.id}`);
  const image = workerImage(s.images?.large || s.images?.common);

  const actors = persons
    .filter((p) => p.relation === "声优")
    .slice(0, 10)
    .map((p) => personRef(p.id, p.name));

  const characterList = characters.slice(0, 10).map((c) => ({
    "@type": "Role",
    character: {
      "@type": "FictionalCharacter",
      name: c.name,
      url: absUrl(`/characters/${c.id}`),
      sameAs: bgmSameAs("character", c.id),
    },
    actor: c.actors?.[0] ? personRef(c.actors[0].id, c.actors[0].name) : undefined,
  }));

  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": subjectSchemaType(s.type),
    name: s.name_cn || s.name,
    alternateName: s.name_cn && s.name !== s.name_cn ? s.name : undefined,
    description: s.summary || undefined,
    image,
    url,
    sameAs: bgmSameAs("subject", s.id),
    datePublished: s.date || undefined,
    dateModified: s.date || undefined,
    numberOfEpisodes: s.eps > 0 ? s.eps : undefined,
    genre: SubjectTypeLabel[s.type] ?? undefined,
    keywords: s.tags?.length
      ? s.tags
          .slice(0, 10)
          .map((t) => t.name)
          .join(", ")
      : undefined,
    actor: actors.length ? actors : undefined,
    character: characterList.length ? characterList : undefined,
    aggregateRating:
      s.rating?.score > 0 && s.rating.total >= RATING_MIN_TOTAL
        ? {
            "@type": "AggregateRating",
            ratingValue: s.rating.score.toFixed(1),
            ratingCount: s.rating.total,
            bestRating: "10",
          }
        : undefined,
  };
  pruneFalsy(base);
  return base;
}

export function episodeJsonLd(
  ep: EpisodeDetail,
  subject?: Subject | null,
): Record<string, unknown> {
  const url = absUrl(`/episodes/${ep.id}`);
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "TVEpisode",
    name: ep.name_cn || ep.name || `第 ${ep.sort} 话`,
    episodeNumber: ep.sort,
    url,
    sameAs: bgmSameAs("subject", ep.subject_id),
    datePublished: ep.airdate || undefined,
    duration: ep.duration || undefined,
    description: ep.desc || undefined,
    partOfTVSeries: subject
      ? {
          "@type": "TVSeries",
          name: subject.name_cn || subject.name,
          url: absUrl(`/subjects/${subject.id}`),
          sameAs: bgmSameAs("subject", subject.id),
        }
      : undefined,
  };
  pruneFalsy(obj);
  return obj;
}

export function characterJsonLd(
  c: Character,
  persons: CharacterPerson[] = [],
): Record<string, unknown> {
  const url = absUrl(`/characters/${c.id}`);
  const performers = persons
    .filter((p) => p.staff === "声优" || p.staff === "演员")
    .slice(0, 5)
    .map((p) => ({
      "@type": "Role",
      performer: personRef(p.id, p.name),
    }));
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FictionalCharacter",
    name: c.name,
    description: c.summary || undefined,
    url,
    image: workerImage(c.images?.large || c.images?.medium),
    sameAs: bgmSameAs("character", c.id),
    gender: c.gender || undefined,
    performer: performers.length ? performers : undefined,
  };
  pruneFalsy(obj);
  return obj;
}

export function personJsonLd(p: PersonDetail): Record<string, unknown> {
  const url = absUrl(`/persons/${p.id}`);
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: p.name,
    description: p.summary || undefined,
    url,
    image: workerImage(p.images?.large || p.images?.medium),
    sameAs: bgmSameAs("person", p.id),
    gender: p.gender || undefined,
    birthDate:
      p.birth_year && p.birth_mon && p.birth_day
        ? `${p.birth_year}-${String(p.birth_mon).padStart(2, "0")}-${String(p.birth_day).padStart(2, "0")}`
        : undefined,
    jobTitle: p.career?.length ? p.career.join(", ") : undefined,
  };
  pruneFalsy(obj);
  return obj;
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon.svg`,
      },
      sameAs: [GITHUB_URL],
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/subjects?keyword={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(path: string): Record<string, unknown> {
  const segments = path.split("/").filter(Boolean);
  const items: Array<Record<string, unknown>> = [
    { "@type": "ListItem", position: 1, name: "首页", item: SITE_URL },
  ];
  const listNames: Record<string, string> = {
    subjects: "条目",
    characters: "角色",
    persons: "人物",
    episodes: "章节",
  };
  let href = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    href += `/${seg}`;
    const isLast = i === segments.length - 1;
    const name = isLast ? undefined : listNames[seg];
    if (name) {
      items.push({ "@type": "ListItem", position: items.length + 1, name, item: absUrl(href) });
    }
  }
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items,
  };
}

export function itemListJsonLd(
  items: Array<{ id: number; name: string; url: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      url: absUrl(item.url),
    })),
  };
}
