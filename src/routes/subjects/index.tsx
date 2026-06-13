import { createFileRoute } from "@tanstack/react-router";
import { useState, useCallback } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SubjectCard } from "@/components/subject-card";
import { SearchInput } from "@/components/search-input";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScroll } from "@/components/infinite-scroll";
import { Skeleton } from "@/components/ui/skeleton";
import { browseSubjects, searchSubjects } from "@/server/functions";
import { SubjectType, SubjectTypeLabel } from "@/types";
import type { PagedResponse, Subject } from "@/types";

const PAGE_SIZE = 20;

export const Route = createFileRoute("/subjects/")({
	loader: async () =>
		browseSubjects({
			data: { type: SubjectType.Anime, sort: "rank", limit: PAGE_SIZE },
		}),
	component: SubjectsPage,
});

function SubjectsPage() {
	const initialData = Route.useLoaderData() as PagedResponse<Subject>;
	const [keyword, setKeyword] = useState("");
	const [typeFilter, setTypeFilter] = useState<string>("all");

	const isSearching = keyword.trim().length > 0;

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery({
			queryKey: ["subjects", keyword, typeFilter],
			queryFn: async ({ pageParam = 0 }) => {
				if (isSearching) {
					return searchSubjects({
						data: {
							keyword,
							sort: "rank",
							filter:
								typeFilter !== "all"
									? { type: [Number(typeFilter) as SubjectType] }
									: undefined,
							limit: PAGE_SIZE,
							offset: pageParam,
						},
					});
				}
				return browseSubjects({
					data: {
						type: (typeFilter !== "all"
							? Number(typeFilter)
							: SubjectType.Anime) as SubjectType,
						sort: "rank",
						limit: PAGE_SIZE,
						offset: pageParam,
					},
				});
			},
			initialPageParam: 0,
			getNextPageParam: (lastPage) => {
				const nextOffset = lastPage.offset + lastPage.limit;
				return nextOffset < lastPage.total ? nextOffset : undefined;
			},
			initialData: {
				pages: [initialData],
				pageParams: [0],
			},
		});

	const subjects = data?.pages.flatMap((page) => page.data) ?? [];

	const handleSearch = useCallback((value: string) => {
		setKeyword(value);
	}, []);

	return (
		<div>
			<h1 className="mb-4 text-2xl font-bold">条目</h1>

			<div className="mb-6 flex flex-col gap-3 sm:flex-row">
				<div className="flex-1">
					<SearchInput
						value={keyword}
						onSearch={handleSearch}
						placeholder="搜索条目..."
					/>
				</div>
				<Select
					value={typeFilter}
					onValueChange={(v) => setTypeFilter(v ?? "all")}
				>
					<SelectTrigger className="w-full sm:w-40">
						<SelectValue placeholder="类型" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">全部</SelectItem>
						{Object.entries(SubjectTypeLabel).map(([value, label]) => (
							<SelectItem key={value} value={String(value)}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{isLoading ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
					{Array.from({ length: PAGE_SIZE }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
						<div key={`sk-${i}`}>
							<Skeleton className="aspect-[3/4] rounded-lg" />
							<Skeleton className="mt-2 h-4 w-3/4" />
						</div>
					))}
				</div>
			) : subjects.length === 0 ? (
				<EmptyState
					title="没有找到条目"
					description={isSearching ? "请尝试其他关键词" : "暂无数据"}
				/>
			) : (
				<>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
						{subjects.map((s) => (
							<SubjectCard
								key={s.id}
								id={s.id}
								name={s.name}
								nameCn={s.name_cn}
								image={s.images?.large || s.images?.common}
								score={s.rating?.score ?? 0}
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
