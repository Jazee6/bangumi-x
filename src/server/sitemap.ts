import { absoluteUrl, SITE_URL } from "@/lib/seo/site";
import type {
	PagedResponse,
	RelatedCharacter,
	RelatedPerson,
	Subject,
} from "@/types";
import { SubjectType } from "@/types";
import { bgmFetch, buildParams } from "./utils";

declare const caches: { default: Cache } & CacheStorage;

/**
 * 站点地图（单个 /sitemap.xml）。
 *
 * 架构：运行时实时计算，边缘缓存（caches.default + 响应 s-maxage）。
 * 详见 src/routes/sitemap[.]xml.tsx 与 robots.txt 的 Sitemap 引用。
 *
 * 内容（有界切片）：
 * - 静态页：/ 与 /subjects（characters/persons 列表页始终 noindex，不收录）。
 * - 热门 subject：全 5 类 type，每类 browse by rank top-N，去 nsfw。
 * - 派生角色/人物：从每类 top-M 的 subject relations 聚合，按跨作品出现频次取 top-K。
 *   episodes 无可靠“热门”来源且 SEO 价值低，不收录。
 *
 * 免费档子请求预算：Cloudflare Workers 免费档单请求子请求上限 50。
 * 冷缓存总调用 = 5（browse）+ 2 × 5 × RELATIONS_PER_TYPE（relations）。
 * RELATIONS_PER_TYPE=4 → 5 + 40 = 45，留 5 次余量。subjects 先拉并固化，
 * 派生单独容错——即便派生超限抛错，也只丢角色/人物 URL，不连累 subject。
 * 边缘缓存命中时（6h 内）零上游调用。
 */

/** 全部需要切片的 subject 类型。 */
const SUBJECT_TYPES: SubjectType[] = [
	SubjectType.Book,
	SubjectType.Anime,
	SubjectType.Music,
	SubjectType.Game,
	SubjectType.Real,
];

/** 每类 browse 取多少个热门 subject（limit 上限 50，单页一次调用）。 */
const TOP_N_PER_TYPE = 50;
/**
 * 每类从多少个 subject 拉 relations 做派生（取该类 rank 靠前的若干个）。
 * 受免费档 50 子请求上限约束：5 + 2×5×R < 50 → R ≤ 4。
 */
const RELATIONS_PER_TYPE = 4;
/** 每个 subject 的 relations 里取多少个角色/人物参与聚合。 */
const RELATIONS_TAKE = 3;
/** 派生角色/人物各自最终收录的上限。 */
const DERIVED_LIMIT = 50;

/** 角色在作品中的关系优先级（主角优先），用于排序后取前若干个。 */
const CHARACTER_RELATION_ORDER = ["主角", "配角", "客串", "其他"];

function relationScore(relation: string): number {
	const idx = CHARACTER_RELATION_ORDER.indexOf(relation);
	return idx === -1 ? CHARACTER_RELATION_ORDER.length : idx;
}

interface SitemapUrls {
	staticUrls: string[];
	subjectUrls: string[];
	characterUrls: string[];
	personUrls: string[];
}

/**
 * 拉取热门 subject（全 5 类 × top-N，去 nsfw）。这是 sitemap 的主体，必须稳健：
 * 单类 browse 失败只跳过该类，全失败返回空数组（由外层补静态页）。
 */
async function collectSubjects(): Promise<{
	subjectsByType: Subject[][];
	subjectUrls: string[];
}> {
	const browseResults = await Promise.allSettled(
		SUBJECT_TYPES.map((type) =>
			bgmFetch<PagedResponse<Subject>>(
				`/v0/subjects?${buildParams({ type, sort: "rank", limit: TOP_N_PER_TYPE })}`,
				{ cacheTtl: 600 },
			),
		),
	);

	const subjectsByType: Subject[][] = [];
	const subjectUrls: string[] = [];
	for (const r of browseResults) {
		if (r.status !== "fulfilled") continue;
		const items = r.value.data.filter((s) => !s.nsfw);
		subjectsByType.push(items);
		for (const s of items) subjectUrls.push(absoluteUrl(`/subjects/${s.id}`));
	}
	return { subjectsByType, subjectUrls };
}

/**
 * 派生角色/人物：从每类 top-M subject 的 relations 聚合。
 * 整段容错——任何失败（含超子请求上限）都返回空数组，绝不连累已拿到的 subject。
 */
async function collectDerived(
	subjectsByType: Subject[][],
): Promise<{ characterUrls: string[]; personUrls: string[] }> {
	const relationIds = subjectsByType
		.flatMap((items) => items.slice(0, RELATIONS_PER_TYPE))
		.map((s) => s.id);

	try {
		const [charResults, personResults] = await Promise.all([
			Promise.allSettled(
				relationIds.map((id) =>
					bgmFetch<RelatedCharacter[]>(`/v0/subjects/${id}/characters`, {
						cacheTtl: 600,
					}),
				),
			),
			Promise.allSettled(
				relationIds.map((id) =>
					bgmFetch<RelatedPerson[]>(`/v0/subjects/${id}/persons`, {
						cacheTtl: 600,
					}),
				),
			),
		]);

		const characterUrls = aggregateDerived(
			charResults,
			// 每个作品内按关系优先级排序后取前若干个主角，再跨作品计频次。
			(chars) =>
				[...chars]
					.sort((a, b) => relationScore(a.relation) - relationScore(b.relation))
					.slice(0, RELATIONS_TAKE)
					.map((c) => c.id),
			(id) => absoluteUrl(`/characters/${id}`),
		);

		const personUrls = aggregateDerived(
			personResults,
			// 人物无“主角”概念，取列表前若干个（API 默认顺序）。
			(persons) => persons.slice(0, RELATIONS_TAKE).map((p) => p.id),
			(id) => absoluteUrl(`/persons/${id}`),
		);

		return { characterUrls, personUrls };
	} catch (err) {
		console.warn(
			"[sitemap] derivation failed, skipping characters/persons",
			err,
		);
		return { characterUrls: [], personUrls: [] };
	}
}

/**
 * 聚合派生 ID：对每个成功的关系列表用 pickIds 取候选 ID，统计跨作品出现频次，
 * 取频次最高的前 DERIVED_LIMIT 个（同频按 id 升序稳定排序），映射为 URL。
 */
function aggregateDerived<T>(
	results: PromiseSettledResult<T[]>[],
	pickIds: (items: T[]) => number[],
	toUrl: (id: number) => string,
): string[] {
	const counts = new Map<number, number>();
	for (const r of results) {
		if (r.status !== "fulfilled") continue;
		for (const id of pickIds(r.value)) {
			counts.set(id, (counts.get(id) ?? 0) + 1);
		}
	}
	const top = [...counts.entries()]
		.sort((a, b) => b[1] - a[1] || a[0] - b[0])
		.slice(0, DERIVED_LIMIT)
		.map(([id]) => id);
	return top.map(toUrl);
}

function escapeXml(value: string): string {
	return value.replace(/[<>&'"]/g, (ch) => {
		switch (ch) {
			case "<":
				return "&lt;";
			case ">":
				return "&gt;";
			case "&":
				return "&amp;";
			case "'":
				return "&apos;";
			case '"':
				return "&quot;";
			default:
				return ch;
		}
	});
}

function urlEntry(loc: string): string {
	return `  <url>\n    <loc>${escapeXml(loc)}</loc>\n  </url>`;
}

/**
 * 构建完整 sitemap XML。省略 lastmod（上游无修改时间字段）、changefreq、priority
 * （Google 基本忽略）。仅静态页 + 热门 subject + 派生角色/人物。
 */
export function buildSitemapXml(urls: SitemapUrls): string {
	const all = [
		...urls.staticUrls,
		...urls.subjectUrls,
		...urls.characterUrls,
		...urls.personUrls,
	];
	const body = all.map(urlEntry).join("\n");
	return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;
}

/**
 * 构建 sitemap：拉热门 subject → 拉派生 → 拼 XML。
 * subjects 为主体重失败也尽量保留；派生全失败只丢角色/人物；browse 全挂才退到纯静态页。
 * 永不抛错——sitemap 宁可少几条 URL 也不该 5xx，否则爬虫会降低抓取频率。
 */
export async function buildSitemap(): Promise<string> {
	const staticUrls = [absoluteUrl("/"), absoluteUrl("/subjects")];

	let subjectsByType: Subject[][] = [];
	let subjectUrls: string[] = [];
	try {
		const collected = await collectSubjects();
		subjectsByType = collected.subjectsByType;
		subjectUrls = collected.subjectUrls;
	} catch (err) {
		console.warn("[sitemap] subject collection failed, static only", err);
		return buildSitemapXml({
			staticUrls,
			subjectUrls: [],
			characterUrls: [],
			personUrls: [],
		});
	}

	const { characterUrls, personUrls } = await collectDerived(subjectsByType);

	return buildSitemapXml({
		staticUrls,
		subjectUrls,
		characterUrls,
		personUrls,
	});
}

/** 边缘缓存 key（caches.default）。版本号变更可使全量失效。 */
export const SITEMAP_CACHE_KEY = new Request(
	`${SITE_URL}/__cache/sitemap.xml`,
	{
		method: "GET",
	},
);

/** sitemap 自身边缘缓存 TTL（秒），对应 s-maxage=21600（6h）。 */
export const SITEMAP_CACHE_TTL = 21600;
