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
import { searchPersons } from "@/server/functions";
import type { PagedResponse, Person } from "@/types";

const PAGE_SIZE = 20;

const searchSchema = z.object({
	keyword: z.string().optional(),
});

export const Route = createFileRoute("/persons/")({
	validateSearch: (search) => searchSchema.parse(search),
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
		<div>
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
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{persons.map((p) => (
							<PersonCard
								key={p.id}
								id={p.id}
								name={p.name}
								image={p.images?.large || p.images?.medium}
								to="/persons/$personId"
								subtitle={p.short_summary?.slice(0, 40)}
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
