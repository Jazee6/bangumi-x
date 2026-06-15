import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScroll } from "@/components/infinite-scroll";
import { PersonCard } from "@/components/person-card";
import { SearchInput } from "@/components/search-input";
import { PersonCardSkeleton } from "@/components/skeletons/person-card-skeleton";
import { Typography } from "@/components/ui/typography";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildMeta } from "@/lib/seo/site";
import { searchPersons } from "@/server/functions";
import type { PagedResponse, Person } from "@/types";

const PAGE_SIZE = 20;

const searchSchema = z.object({
	keyword: z.string().optional(),
});

export const Route = createFileRoute("/persons/")({
	validateSearch: searchSchema,
	// 人物搜索页 noindex，不缓存（每个用户的搜索都不同）。
	headers: () => ({ "Cache-Control": "private, no-store" }),
	head: ({ match }) => {
		const keyword =
			(match.search as { keyword?: string } | undefined)?.keyword ?? "";
		const title = keyword ? `搜索「${keyword}」 - 人物` : "人物搜索";
		const description = keyword
			? `在 Bangumi X 上搜索「${keyword}」相关人物（声优、制作人、演员、漫画家等）。`
			: "Bangumi X 人物搜索：按关键词查询声优、制作人、漫画家、艺术家等业界人物资料。";
		const { meta, links } = buildMeta({
			title,
			description,
			path: "/persons",
			noindex: true,
		});
		return {
			meta,
			links,
			...serializeJsonLd(
				breadcrumbJsonLd([
					{ name: "首页", path: "/" },
					{ name: "人物", path: "/persons" },
				]),
			),
		};
	},
	component: PersonsPage,
});

function PersonsPage() {
	const search = Route.useSearch();
	const keyword = search.keyword ?? "";
	const navigate = useNavigate();

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery({
			queryKey: ["persons", keyword],
			queryFn: ({ pageParam = 0 }) =>
				searchPersons({
					data: { keyword, limit: PAGE_SIZE, offset: pageParam },
				}) as Promise<PagedResponse<Person>>,
			initialPageParam: 0,
			getNextPageParam: (lastPage) => {
				const nextOffset = lastPage.offset + lastPage.limit;
				return nextOffset < lastPage.total ? nextOffset : undefined;
			},
			enabled: keyword.trim().length > 0,
		});

	const persons = data?.pages.flatMap((page) => page.data) ?? [];

	const handleSearch = useCallback(
		(value: string) => {
			navigate({
				to: ".",
				search: { keyword: value || undefined },
			});
		},
		[navigate],
	);

	return (
		<article>
			<Typography variant="h1" className="mb-4">
				人物
			</Typography>

			<div className="mb-6">
				<SearchInput
					value={keyword}
					onSearch={handleSearch}
					placeholder="搜索人物..."
				/>
			</div>

			{!keyword.trim() ? (
				<EmptyState title="搜索人物" description="输入关键词开始搜索" />
			) : isLoading ? (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 8 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
						<PersonCardSkeleton key={`sk-${i}`} />
					))}
				</div>
			) : persons.length === 0 ? (
				<EmptyState title="没有找到人物" description="请尝试其他关键词" />
			) : (
				<>
					<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
						{persons.map((p) => (
							<li key={p.id}>
								<PersonCard
									id={p.id}
									name={p.name}
									image={p.images?.large || p.images?.medium}
									to="/persons/$personId"
									subtitle={p.short_summary?.slice(0, 40)}
								/>
							</li>
						))}
					</ul>
					<InfiniteScroll
						hasMore={hasNextPage}
						loading={isFetchingNextPage}
						onLoadMore={() => fetchNextPage()}
					/>
				</>
			)}
		</article>
	);
}
