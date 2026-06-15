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
import { searchCharacters } from "@/server/functions";
import type { Character, PagedResponse } from "@/types";

const PAGE_SIZE = 20;

const searchSchema = z.object({
	keyword: z.string().optional(),
});

export const Route = createFileRoute("/characters/")({
	validateSearch: searchSchema,
	// 角色搜索页本身 noindex，缓存设私有禁存（每用户搜索不同）。
	headers: () => ({ "Cache-Control": "private, no-store" }),
	head: ({ match }) => {
		const keyword =
			(match.search as { keyword?: string } | undefined)?.keyword ?? "";
		const title = keyword ? `搜索「${keyword}」 - 角色` : "角色搜索";
		const description = keyword
			? `在 Bangumi X 上搜索「${keyword}」相关角色。`
			: "Bangumi X 角色搜索：按关键词查询动画、漫画、游戏中的虚拟角色资料。";
		const { meta, links } = buildMeta({
			title,
			description,
			path: "/characters",
			noindex: true,
		});
		return {
			meta,
			links,
			...serializeJsonLd(
				breadcrumbJsonLd([
					{ name: "首页", path: "/" },
					{ name: "角色", path: "/characters" },
				]),
			),
		};
	},
	component: CharactersPage,
});

function CharactersPage() {
	const search = Route.useSearch();
	const keyword = search.keyword ?? "";
	const navigate = useNavigate();

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery({
			queryKey: ["characters", keyword],
			queryFn: ({ pageParam = 0 }) =>
				searchCharacters({
					data: { keyword, limit: PAGE_SIZE, offset: pageParam },
				}) as Promise<PagedResponse<Character>>,
			initialPageParam: 0,
			getNextPageParam: (lastPage) => {
				const nextOffset = lastPage.offset + lastPage.limit;
				return nextOffset < lastPage.total ? nextOffset : undefined;
			},
			enabled: keyword.trim().length > 0,
		});

	const characters = data?.pages.flatMap((page) => page.data) ?? [];

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
				角色
			</Typography>

			<div className="mb-6">
				<SearchInput
					value={keyword}
					onSearch={handleSearch}
					placeholder="搜索角色..."
				/>
			</div>

			{!keyword.trim() ? (
				<EmptyState title="搜索角色" description="输入关键词开始搜索" />
			) : isLoading ? (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 8 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
						<PersonCardSkeleton key={`sk-${i}`} />
					))}
				</div>
			) : characters.length === 0 ? (
				<EmptyState title="没有找到角色" description="请尝试其他关键词" />
			) : (
				<>
					<ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
						{characters.map((c) => (
							<li key={c.id}>
								<PersonCard
									id={c.id}
									name={c.name}
									image={c.images?.large || c.images?.medium}
									to="/characters/$characterId"
									subtitle={c.summary?.slice(0, 40)}
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
