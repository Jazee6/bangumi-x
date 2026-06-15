/**
 * 站点级 SEO 常量与工具函数。
 *
 * 所有 canonical / OG url / sitemap <loc> / JSON-LD @id 都以 SITE_URL 为基准。
 */

export const SITE_URL = "https://bgmx.jaze.top";
export const SITE_NAME = "Bangumi X";
export const SITE_LOCALE = "zh_CN";
export const SITE_DESCRIPTION =
	"Bangumi X 是基于 Bangumi 番组计划开放数据构建的现代化番剧、漫画、游戏、音乐资料检索站，提供条目、章节、角色、声优制作人等结构化信息。";

/** 站点默认 keywords，仅作为兜底；详情页会用动态信息替换。 */
export const SITE_KEYWORDS = [
	"Bangumi",
	"番组计划",
	"番剧",
	"动画",
	"漫画",
	"游戏",
	"声优",
	"动画评分",
	"新番表",
] as const;

/** 给定路径返回完整 canonical URL。path 应以 `/` 开头。 */
export function absoluteUrl(path: string): string {
	if (path.startsWith("http://") || path.startsWith("https://")) return path;
	const normalized = path.startsWith("/") ? path : `/${path}`;
	return `${SITE_URL}${normalized}`;
}

/** 截断字符串到指定长度，并去除空白与多余换行。 */
export function clampText(input: string | undefined | null, max = 160): string {
	if (!input) return "";
	const cleaned = input.replace(/\s+/g, " ").trim();
	if (cleaned.length <= max) return cleaned;
	// 留一个全角省略号
	return `${cleaned.slice(0, max - 1)}…`;
}

export interface BuildMetaInput {
	/** 页面标题主体（不要包含站名）。空字符串走默认 title。 */
	title?: string;
	description?: string;
	/** canonical 路径（不含 origin），如 `/subjects/123`。 */
	path: string;
	/** OG 图片路径或绝对 URL；不传走站点默认。 */
	image?: string;
	/**
	 * 详情页传这个走动态 OG 图（`/api/og/:type/:id.png`），
	 * 优先级高于 `image`。社交平台预览拿动态 1200×630 PNG，
	 * 而 JSON-LD 等仍可用 `image` 字段独立指向原始封面。
	 */
	dynamicOg?: {
		type: "subject" | "character" | "person" | "episode";
		id: number;
	};
	/** og:type，默认 website。详情页可用 article / video.tv_show 等。 */
	ogType?: string;
	/** 是否禁止索引。带搜索参数的列表页设 true。 */
	noindex?: boolean;
	/** 额外 keywords。 */
	keywords?: string[];
}

export interface MetaTag {
	name?: string;
	property?: string;
	content?: string;
	title?: string;
	charSet?: string;
}

export interface LinkTag {
	rel: string;
	href: string;
	type?: string;
}

/** 生成一个详情/列表页的 meta + link 列表，已含 OG/Twitter/canonical。 */
export function buildMeta(input: BuildMetaInput): {
	meta: MetaTag[];
	links: LinkTag[];
} {
	const fullTitle = input.title ? `${input.title} - ${SITE_NAME}` : SITE_NAME;
	const description = clampText(input.description ?? SITE_DESCRIPTION, 160);
	const canonical = absoluteUrl(input.path);
	const image = input.dynamicOg
		? absoluteUrl(`/api/og/${input.dynamicOg.type}/${input.dynamicOg.id}.png`)
		: input.image
			? absoluteUrl(input.image)
			: absoluteUrl("/og-default.png");
	const ogType = input.ogType ?? "website";
	const keywords = (input.keywords ?? SITE_KEYWORDS).join(",");

	const meta: MetaTag[] = [
		{ title: fullTitle },
		{ name: "description", content: description },
		{ name: "keywords", content: keywords },
		{
			name: "robots",
			content: input.noindex
				? "noindex,follow"
				: "index,follow,max-image-preview:large,max-snippet:-1",
		},
		// Open Graph
		{ property: "og:type", content: ogType },
		{ property: "og:site_name", content: SITE_NAME },
		{ property: "og:title", content: fullTitle },
		{ property: "og:description", content: description },
		{ property: "og:url", content: canonical },
		{ property: "og:image", content: image },
		{ property: "og:locale", content: SITE_LOCALE },
		// Twitter
		{ name: "twitter:card", content: "summary_large_image" },
		{ name: "twitter:title", content: fullTitle },
		{ name: "twitter:description", content: description },
		{ name: "twitter:image", content: image },
	];

	// noindex 页面不需要 canonical，避免与 robots 信号冲突。
	const links: LinkTag[] = input.noindex
		? []
		: [{ rel: "canonical", href: canonical }];

	return { meta, links };
}
