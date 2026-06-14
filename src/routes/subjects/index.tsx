import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScroll } from "@/components/infinite-scroll";
import { SearchInput } from "@/components/search-input";
import { Typography } from "@/components/ui/typography";
import { SubjectCard } from "@/components/subject-card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { browseSubjects, searchSubjects } from "@/server/functions";
import type { PagedResponse, Subject } from "@/types";
import { SubjectType, SubjectTypeLabel } from "@/types";

const ALL_LABEL = "全部";
const typeValueToLabel: Record<string, string> = {
	all: ALL_LABEL,
	...Object.fromEntries(
		Object.entries(SubjectTypeLabel).map(([v, l]) => [v, l]),
	),
};
const typeLabelToValue: Record<string, string> = Object.fromEntries(
	Object.entries(typeValueToLabel).map(([v, l]) => [l, v]),
);

const PAGE_SIZE = 20;

const searchSchema = z.object({
	keyword: z.string().optional(),
	type: z.string().optional(),
});

export const Route = createFileRoute("/subjects/")({
	validateSearch: searchSchema,
	loaderDeps: ({ search }) => ({
		keyword: search.keyword ?? "",
		type: search.type ?? ALL_LABEL,
	}),
	loader: async ({ deps }) => {
		const typeValue = typeLabelToValue[deps.type];
		const isAll = typeValue === "all";
		if (deps.keyword.trim()) {
			return searchSubjects({
				data: {
					keyword: deps.keyword,
					sort: "rank",
					filter: !isAll
						? { type: [Number(typeValue) as SubjectType] }
						: undefined,
					limit: PAGE_SIZE,
				},
			});
		}
		return browseSubjects({
			data: {
				type: (!isAll ? Number(typeValue) : SubjectType.Anime) as SubjectType,
				sort: "rank",
				limit: PAGE_SIZE,
			},
		});
	},
	pendingComponent: () => (
		<div>
			<Skeleton className="mb-4 h-8 w-16" />
			<div className="mb-6 flex flex-col gap-3 sm:flex-row">
				<Skeleton className="h-10 flex-1" />
				<Skeleton className="h-10 w-full sm:w-40" />
			</div>
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
				{Array.from({ length: PAGE_SIZE }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
					<div key={`sk-${i}`}>
						<Skeleton className="aspect-3/4 rounded-lg" />
						<Skeleton className="mt-2 h-4 w-3/4" />
					</div>
				))}
			</div>
		</div>
	),
	component: SubjectsPage,
});

function SubjectsPage() {
	const initialData = Route.useLoaderData() as PagedResponse<Subject>;
	const search = Route.useSearch();
	const keyword = search.keyword ?? "";
	const type = search.type ?? ALL_LABEL;
	const navigate = useNavigate();

	const updateSearch = useCallback(
		(updates: Partial<{ keyword: string; type: string }>) => {
			const next = { keyword, type, ...updates };
			navigate({
				to: ".",
				search: {
					keyword: next.keyword || undefined,
					type: next.type === ALL_LABEL ? undefined : next.type,
				},
			});
		},
		[navigate, keyword, type],
	);

	const isSearching = keyword.trim().length > 0;

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery({
			queryKey: ["subjects", keyword, type],
			queryFn: async ({ pageParam = 0 }) => {
				const typeValue = typeLabelToValue[type];
				const isAll = typeValue === "all";
				if (isSearching) {
					return searchSubjects({
						data: {
							keyword,
							sort: "rank",
							filter: !isAll
								? { type: [Number(typeValue) as SubjectType] }
								: undefined,
							limit: PAGE_SIZE,
							offset: pageParam,
						},
					});
				}
				return browseSubjects({
					data: {
						type: (!isAll
							? Number(typeValue)
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

	const handleSearch = useCallback(
		(value: string) => {
			updateSearch({ keyword: value });
		},
		[updateSearch],
	);

	return (
		<div>
			<Typography variant="h1" className="mb-4">
				条目
			</Typography>

			<div className="mb-6 flex flex-col gap-3 sm:flex-row">
				<div className="flex-1">
					<SearchInput
						value={keyword}
						onSearch={handleSearch}
						placeholder="搜索条目..."
					/>
				</div>
				<Select
					value={type}
					onValueChange={(v) => updateSearch({ type: v ?? ALL_LABEL })}
				>
					<SelectTrigger className="w-full sm:w-40">
						<SelectValue placeholder="类型" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL_LABEL}>{ALL_LABEL}</SelectItem>
						{Object.entries(SubjectTypeLabel).map(([value, label]) => (
							<SelectItem key={value} value={label}>
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
							<Skeleton className="aspect-3/4 rounded-lg" />
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
						hasMore={hasNextPage}
						loading={isFetchingNextPage}
						onLoadMore={() => fetchNextPage()}
					/>
				</>
			)}
		</div>
	);
}
