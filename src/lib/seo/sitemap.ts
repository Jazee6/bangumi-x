/**
 * Sitemap 拼接工具：仅做字符串拼接，不依赖任何 IO，方便单测。
 */

export interface SitemapEntry {
	loc: string;
	lastmod?: string;
	changefreq?:
		| "always"
		| "hourly"
		| "daily"
		| "weekly"
		| "monthly"
		| "yearly"
		| "never";
	priority?: number;
}

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>';
const URLSET_OPEN =
	'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const URLSET_CLOSE = "</urlset>";
const SITEMAPINDEX_OPEN =
	'<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">';
const SITEMAPINDEX_CLOSE = "</sitemapindex>";

function escapeXml(s: string): string {
	return s
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&apos;");
}

export function buildSitemap(entries: SitemapEntry[]): string {
	const urls = entries
		.map((e) => {
			const parts = [`<loc>${escapeXml(e.loc)}</loc>`];
			if (e.lastmod) parts.push(`<lastmod>${e.lastmod}</lastmod>`);
			if (e.changefreq) parts.push(`<changefreq>${e.changefreq}</changefreq>`);
			if (e.priority != null)
				parts.push(`<priority>${e.priority.toFixed(1)}</priority>`);
			return `<url>${parts.join("")}</url>`;
		})
		.join("");
	return `${XML_HEAD}${URLSET_OPEN}${urls}${URLSET_CLOSE}`;
}

export interface SitemapIndexEntry {
	loc: string;
	lastmod?: string;
}

export function buildSitemapIndex(entries: SitemapIndexEntry[]): string {
	const items = entries
		.map((e) => {
			const parts = [`<loc>${escapeXml(e.loc)}</loc>`];
			if (e.lastmod) parts.push(`<lastmod>${e.lastmod}</lastmod>`);
			return `<sitemap>${parts.join("")}</sitemap>`;
		})
		.join("");
	return `${XML_HEAD}${SITEMAPINDEX_OPEN}${items}${SITEMAPINDEX_CLOSE}`;
}

/**
 * 单片最大 URL 数。
 *
 * sitemap 协议上限 50000，但我们额外受 Cloudflare Workers 子请求限制
 * （Free 50、Paid 1000）；bangumi `/v0/subjects` 每页最大 50，
 * 所以 2000 URL/片对应 40 子请求/片，Free 与 Paid 均安全。
 */
export const SITEMAP_SHARD_SIZE = 2000;
