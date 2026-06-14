import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScroll } from "@/components/infinite-scroll";
import { PersonCard } from "@/components/person-card";
import { SearchInput } from "@/components/search-input";
import { Typography } from "@/components/ui/typography";
import { Skeleton } from "@/components/ui/skeleton";
import { searchCharacters } from "@/server/functions";
import type { Character, PagedResponse } from "@/types";

const PAGE_SIZE = 20;

const searchSchema = z.object({
	keyword: z.string().optional(),
});

export const Route = createFileRoute("/characters/")({
	validateSearch: (search) => searchSchema.parse(search),
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
		<div>
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
						<div key={`sk-${i}`} className="flex items-center gap-3">
							<Skeleton className="size-12 rounded-full" />
							<div className="flex-1">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="mt-1 h-3 w-16" />
							</div>
						</div>
					))}
				</div>
			) : characters.length === 0 ? (
				<EmptyState title="没有找到角色" description="请尝试其他关键词" />
			) : (
				<>
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{characters.map((c) => (
							<PersonCard
								key={c.id}
								id={c.id}
								name={c.name}
								image={c.images?.large || c.images?.medium}
								to="/characters/$characterId"
								subtitle={c.summary?.slice(0, 40)}
							/>
						))}
					</div>
					<InfiniteScroll
						hasMore={hasNextPage}
						loading={isFetchingNextPage}
						onLoadMore={() => fetchNextPage()}
					/>
				</>
			)}
		</div>
	);
}
