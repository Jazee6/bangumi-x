import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL } from "@/lib/seo/site";
import {
	buildSitemapIndex,
	SITEMAP_SHARD_SIZE,
	type SitemapIndexEntry,
} from "@/lib/seo/sitemap";
import { bgmFetch } from "@/server/utils";
import { SubjectType } from "@/types";

/**
 * 站点 sitemap-index：动态枚举 subjects 分片。
 *
 * 每种条目类型独立分片，shard 大小见 SITEMAP_SHARD_SIZE。各分片的 URL 数
 * 由 bangumi `total` 字段决定，sitemap-index 缓存 24 小时（数据增量缓慢）。
 *
 * 注：bangumi API 不提供 characters / persons 的浏览端点，
 * 这两类 URL 暂依赖详情页内部链接被搜索引擎发现。后续版本可在 D1 中沉淀
 * 引用过的 ID 后再加 sitemap-characters / sitemap-persons 分片。
 */

const SUBJECT_TYPES_FOR_SITEMAP: Array<{
	type: SubjectType;
	slug: string;
}> = [
	{ type: SubjectType.Anime, slug: "anime" },
	{ type: SubjectType.Book, slug: "book" },
	{ type: SubjectType.Game, slug: "game" },
	{ type: SubjectType.Music, slug: "music" },
	{ type: SubjectType.Real, slug: "real" },
];

interface ProbeResponse {
	total: number;
	limit: number;
	offset: number;
}

/** 探针：调一个 limit=1 的请求拿 total，决定分片数。 */
async function probeTotal(type: SubjectType): Promise<number> {
	try {
		const res = await bgmFetch<ProbeResponse>(
			`/v0/subjects?type=${type}&sort=date&limit=1`,
			{ cacheTtl: 86400 },
		);
		return res.total ?? 0;
	} catch {
		return 0;
	}
}

export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: async () => {
				const entries: SitemapIndexEntry[] = [
					{ loc: `${SITE_URL}/sitemap-static.xml` },
				];

				const totals = await Promise.all(
					SUBJECT_TYPES_FOR_SITEMAP.map((s) => probeTotal(s.type)),
				);

				SUBJECT_TYPES_FOR_SITEMAP.forEach((s, i) => {
					const total = totals[i] ?? 0;
					const shardCount = Math.max(1, Math.ceil(total / SITEMAP_SHARD_SIZE));
					for (let shard = 1; shard <= shardCount; shard++) {
						entries.push({
							loc: `${SITE_URL}/sitemap/subjects/${s.slug}/${shard}.xml`,
						});
					}
				});

				return new Response(buildSitemapIndex(entries), {
					headers: {
						"Content-Type": "application/xml; charset=utf-8",
						"Cache-Control":
							"public, max-age=0, s-maxage=86400, stale-while-revalidate=604800",
					},
				});
			},
		},
	},
});
