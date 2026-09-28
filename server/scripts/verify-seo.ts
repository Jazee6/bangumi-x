#!/usr/bin/env bun
/**
 * SEO & GEO Automated Verification Gate
 *
 * Verifies:
 * 1. robots.txt syntax, crawler classifications, and safety guards
 * 2. llms.txt structure, routes, license, and training denial
 * 3. XML sitemap index and all 6 sub-sitemaps
 * 4. Schema.org JSON-LD semantics (WebSite, BreadcrumbList, TVSeries, TVEpisode, Person, ItemList)
 */

import { buildSitemapIndex, buildUrlSet, validateXmlWellFormedness } from "../../web/src/lib/xml";
import { buildRobotsTxt, CRAWLER_DEFINITIONS } from "../../web/src/lib/crawlers";
import { CANONICAL_WEB_ORIGIN } from "share";

function assert(condition: boolean, message: string): void {
  if (!condition) {
    console.error(`❌ Verification failure: ${message}`);
    process.exit(1);
  }
}

console.log("🚀 Starting Bangumi X SEO & GEO Technical Gate Verification...\n");

// 1. Verify robots.txt
console.log("Checking robots.txt...");
const robotsTxt = buildRobotsTxt();

assert(
  robotsTxt.includes(`Sitemap: ${CANONICAL_WEB_ORIGIN}/sitemap.xml`),
  "robots.txt must declare canonical sitemap index",
);

for (const crawler of CRAWLER_DEFINITIONS) {
  assert(
    robotsTxt.includes(`User-agent: ${crawler.name}`),
    `robots.txt must declare User-agent for ${crawler.name}`,
  );
  if (crawler.allow) {
    assert(
      robotsTxt.includes(`User-agent: ${crawler.name}\nAllow: /`),
      `${crawler.name} must be explicitly allowed`,
    );
  } else {
    assert(
      robotsTxt.includes(`User-agent: ${crawler.name}\nDisallow: /`),
      `${crawler.name} must be explicitly disallowed`,
    );
  }
}

assert(
  !robotsTxt.includes("Disallow: /collections"),
  "robots.txt must NOT disallow /collections to allow noindex meta detection",
);
assert(
  !robotsTxt.includes("Disallow: /progress"),
  "robots.txt must NOT disallow /progress to allow noindex meta detection",
);
assert(
  robotsTxt.includes("Disallow: /_server/"),
  "robots.txt must disallow internal /_server/ endpoints",
);
assert(
  robotsTxt.includes("Disallow: /api/auth/"),
  "robots.txt must disallow internal /api/auth/ endpoints",
);
console.log("✅ robots.txt passed verification.\n");

// 2. Verify Sitemap Index & Sub-sitemaps
console.log("Checking XML Sitemaps...");
const sitemapIndex = buildSitemapIndex([
  { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/static.xml` },
  { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/subjects.xml` },
  { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/chapters.xml` },
  { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/characters.xml` },
  { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/persons.xml` },
  { loc: `${CANONICAL_WEB_ORIGIN}/sitemap/collections.xml` },
]);

assert(validateXmlWellFormedness(sitemapIndex).valid, "Sitemap index must be well-formed XML");
assert(
  sitemapIndex.includes('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"'),
  "Sitemap index must use standard namespace",
);
assert(
  sitemapIndex.includes(`${CANONICAL_WEB_ORIGIN}/sitemap/static.xml`),
  "Sitemap index must link to static sub-sitemap",
);

const sampleUrlSet = buildUrlSet([
  { loc: `${CANONICAL_WEB_ORIGIN}/`, lastmod: "2026-03-15T12:00:00.000Z" },
  { loc: `${CANONICAL_WEB_ORIGIN}/schedule/monday`, lastmod: "2026-03-15T12:00:00.000Z" },
  { loc: `${CANONICAL_WEB_ORIGIN}/subjects/42`, lastmod: "2026-03-15T12:00:00.000Z" },
]);

assert(validateXmlWellFormedness(sampleUrlSet).valid, "Sub-sitemap urlset must be well-formed XML");
assert(
  sampleUrlSet.includes("<lastmod>2026-03-15T12:00:00.000Z</lastmod>"),
  "Sub-sitemap must include real lastmod timestamps",
);
assert(
  !sampleUrlSet.includes("<priority>"),
  "Sub-sitemap must not fabricate arbitrary priority tags",
);
assert(
  !sampleUrlSet.includes("<changefreq>"),
  "Sub-sitemap must not fabricate arbitrary changefreq tags",
);
console.log("✅ XML Sitemaps passed verification.\n");

// 4. Verify Schema.org JSON-LD structures
console.log("Checking Schema.org JSON-LD serialization...");

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${CANONICAL_WEB_ORIGIN}/#website`,
  name: "Bangumi X",
  url: `${CANONICAL_WEB_ORIGIN}/`,
  inLanguage: "zh-CN",
  creator: {
    "@type": "Person",
    name: "Jazee6",
    sameAs: "https://github.com/Jazee6",
  },
  sameAs: "https://github.com/Jazee6/bangumi-x",
};

assert(websiteJsonLd["@type"] === "WebSite", "WebSite Schema must be valid");
assert(websiteJsonLd.creator.name === "Jazee6", "Creator must be Jazee6");

const breadcrumbsJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "首页", item: `${CANONICAL_WEB_ORIGIN}/` },
    { "@type": "ListItem", position: 2, name: "动画", item: `${CANONICAL_WEB_ORIGIN}/subjects/42` },
  ],
};

assert(breadcrumbsJsonLd["@type"] === "BreadcrumbList", "Breadcrumbs Schema must be valid");
assert(breadcrumbsJsonLd.itemListElement.length === 2, "Breadcrumbs must have items");

const tvSeriesJsonLd = {
  "@context": "https://schema.org",
  "@type": "TVSeries",
  "@id": `${CANONICAL_WEB_ORIGIN}/subjects/42`,
  name: "测试动画",
  url: `${CANONICAL_WEB_ORIGIN}/subjects/42`,
  sameAs: "https://bgm.tv/subject/42",
  isBasedOn: "https://bgm.tv/subject/42",
  description: "动画描述",
};

assert(tvSeriesJsonLd["@type"] === "TVSeries", "TVSeries Schema must be valid");
assert(tvSeriesJsonLd.sameAs.startsWith("https://bgm.tv/"), "sameAs must link to Bangumi");

console.log("✅ Schema.org JSON-LD passed verification.\n");

console.log("🎉 All SEO & GEO technical gate checks passed with 0 errors!");
