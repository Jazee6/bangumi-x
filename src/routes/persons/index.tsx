import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScroll } from "@/components/infinite-scroll";
import { PersonCard } from "@/components/person-card";
import { SearchInput } from "@/components/search-input";
import { Skeleton } from "@/components/ui/skeleton";
import { searchPersons } from "@/server/functions";
import type { PagedResponse, Person } from "@/types";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/persons/")({
	component: PersonsPage,
});

function PersonsPage() {
	const [keyword, setKeyword] = useState("");

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

	const handleSearch = useCallback((value: string) => {
		setKeyword(value);
	}, []);

	return (
		<div>
			<h1 className="mb-4 text-2xl font-bold">人物</h1>

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
						<div key={`sk-${i}`} className="flex items-center gap-3">
							<Skeleton className="size-12 rounded-full" />
							<div className="flex-1">
								<Skeleton className="h-4 w-24" />
								<Skeleton className="mt-1 h-3 w-16" />
							</div>
						</div>
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
						hasMore={!!hasNextPage}
						loading={isFetchingNextPage}
						onLoadMore={() => fetchNextPage()}
					/>
				</>
			)}
		</div>
	);
}
