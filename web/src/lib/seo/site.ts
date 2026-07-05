import type { Character, EpisodeDetail, PersonDetail, Subject } from "@/types";
import { SubjectType } from "@/types";

export const SITE_NAME = "Bangumi X";
export const SITE_DESCRIPTION = "Bangumi X - 番组计划数据浏览";
export const SITE_URL = "https://bgmx.jaze.top";
export const WORKER_URL = "https://s.bgmx.jaze.top";

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

export function buildMeta(opts: BuildMetaOpts) {
  const title = `${opts.title} | ${SITE_NAME}`;
  const description = opts.description ?? SITE_DESCRIPTION;
  const ogImage = workerImage(opts.image);
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

export function ogImageUrl(type: "subjects" | "characters" | "persons", id: number | string): string {
  return `${WORKER_URL}/og/${type}/${id}`;
}

export function subjectJsonLd(s: Subject): Record<string, unknown> {
  const url = absUrl(`/subjects/${s.id}`);
  const image = workerImage(s.images?.large || s.images?.common);
  const base: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": s.type === SubjectType.Anime ? "TVSeries" : "CreativeWork",
    name: s.name_cn || s.name,
    alternateName: s.name_cn && s.name !== s.name_cn ? s.name : undefined,
    description: s.summary || undefined,
    image,
    url,
    datePublished: s.date || undefined,
    numberOfEpisodes: s.eps > 0 ? s.eps : undefined,
    aggregateRating:
      s.rating?.score > 0 && s.rating.total > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: s.rating.score.toFixed(1),
            ratingCount: s.rating.total,
            bestRating: "10",
          }
        : undefined,
  };
  for (const k of Object.keys(base)) if (base[k] === undefined) delete base[k];
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
    datePublished: ep.airdate || undefined,
    duration: ep.duration || undefined,
    description: ep.desc || undefined,
    partOfTVSeries: subject
      ? {
          "@type": "TVSeries",
          name: subject.name_cn || subject.name,
          url: absUrl(`/subjects/${subject.id}`),
        }
      : undefined,
  };
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

export function characterJsonLd(c: Character): Record<string, unknown> {
  const url = absUrl(`/characters/${c.id}`);
  const obj: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: c.name,
    description: c.summary || undefined,
    url,
    image: workerImage(c.images?.large || c.images?.medium),
    gender: c.gender || undefined,
  };
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
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
    gender: p.gender || undefined,
    birthDate:
      p.birth_year && p.birth_mon && p.birth_day
        ? `${p.birth_year}-${String(p.birth_mon).padStart(2, "0")}-${String(p.birth_day).padStart(2, "0")}`
        : undefined,
    jobTitle: p.career?.length ? p.career.join(", ") : undefined,
  };
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

export function websiteJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description: SITE_DESCRIPTION,
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
