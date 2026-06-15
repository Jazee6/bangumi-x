import { createFileRoute } from "@tanstack/react-router";
import { runWithConcurrency } from "@/lib/concurrency";
import { SITE_URL } from "@/lib/seo/site";
import {
	buildSitemap,
	SITEMAP_SHARD_SIZE,
	type SitemapEntry,
} from "@/lib/seo/sitemap";
import { BgmHttpError, bgmFetch } from "@/server/utils";
import { type Subject, SubjectType } from "@/types";

/**
 * 单个条目类型的 sitemap 分片：
 *   /sitemap/subjects/{slug}/{shard}.xml
 *
 * shard 从 1 开始；每片 SITEMAP_SHARD_SIZE 个 URL。
 *
 * 拆成多段而不是 sitemap-subjects-$slug-$shard.xml 是因为 TanStack Router
 * 单段不支持两个 `$` 参数（一个段一个参数）。
 */

interface SubjectsPage {
	total: number;
	limit: number;
	offset: number;
	data: Pick<Subject, "id" | "date">[];
}

const SLUG_TO_TYPE: Record<string, SubjectType> = {
	anime: SubjectType.Anime,
	book: SubjectType.Book,
	game: SubjectType.Game,
	music: SubjectType.Music,
	real: SubjectType.Real,
};

const PAGE_LIMIT = 50; // bangumi /v0/subjects 单页上限
const CONCURRENCY = 5;
const RETRY_DELAY_MS = 300;

async function fetchPage(
	type: SubjectType,
	offset: number,
): Promise<SubjectsPage> {
	return bgmFetch<SubjectsPage>(
		`/v0/subjects?type=${type}&sort=date&limit=${PAGE_LIMIT}&offset=${offset}`,
		{ cacheTtl: 86400 },
	);
}

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 单页获取，带一次按状态码区分的重试。 */
async function fetchPageWithRetry(
	type: SubjectType,
	offset: number,
): Promise<SubjectsPage | null> {
	try {
		return await fetchPage(type, offset);
	} catch (err) {
		const status = err instanceof BgmHttpError ? err.status : 0;
		const shouldRetry = status >= 500 || status === 429;
		if (!shouldRetry) return null;

		if (status === 429) await sleep(RETRY_DELAY_MS);

		try {
			return await fetchPage(type, offset);
		} catch {
			return null;
		}
	}
}

export const Route = createFileRoute("/sitemap/subjects/$slug/$shard")({
	server: {
		handlers: {
			GET: async ({ params, request }) => {
				const slug = params.slug;
				const shardParam = params.shard;
				// `$shard` 段会带上 `.xml` 后缀，剥掉。
				const shardStr = shardParam.replace(/\.xml$/, "");
				const type = SLUG_TO_TYPE[slug];
				const shard = Number(shardStr);

				if (
					!type ||
					!Number.isFinite(shard) ||
					shard < 1 ||
					!shardParam.endsWith(".xml") ||
					!new URL(request.url).pathname.endsWith(".xml")
				) {
					return new Response("Not found", { status: 404 });
				}

				// 该分片对应的 [startOffset, endOffset)
				const startOffset = (shard - 1) * SITEMAP_SHARD_SIZE;
				const endOffsetCap = shard * SITEMAP_SHARD_SIZE;

				const collected: Pick<Subject, "id" | "date">[] = [];
				const pageOffsets: number[] = [];
				for (
					let offset = startOffset;
					offset < endOffsetCap;
					offset += PAGE_LIMIT
				) {
					pageOffsets.push(offset);
				}

				// 受 Worker 子请求数限制，单分片最多触发
				// SITEMAP_SHARD_SIZE / PAGE_LIMIT = 40 个子请求；用并发池控制同时请求数。
				const pages = await runWithConcurrency(
					pageOffsets.map((offset) => () => fetchPageWithRetry(type, offset)),
					CONCURRENCY,
				);

				for (const page of pages) {
					if (!page?.data) continue;
					collected.push(...page.data);
					if (page.offset + page.limit >= page.total) break;
				}

				const entries: SitemapEntry[] = collected.map((s) => ({
					loc: `${SITE_URL}/subjects/${s.id}`,
					...(s.date ? { lastmod: s.date } : {}),
					changefreq: "weekly",
					priority: 0.6,
				}));

				return new Response(buildSitemap(entries), {
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
