import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import { z } from "zod";
import { EmptyState } from "@/components/empty-state";
import { InfiniteScroll } from "@/components/infinite-scroll";
import { SearchInput } from "@/components/search-input";
import { SubjectCardSkeleton } from "@/components/skeletons/subject-card-skeleton";
import { SubjectCard } from "@/components/subject-card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Typography } from "@/components/ui/typography";
import {
	browseSubjectsQueryOptions,
	searchSubjectsQueryOptions,
} from "@/lib/queries/subjects";
import { breadcrumbJsonLd, serializeJsonLd } from "@/lib/seo/json-ld";
import { buildMeta } from "@/lib/seo/site";
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
	headers: ({ match }) => {
		const search = match.search as
			| { keyword?: string; type?: string }
			| undefined;
		const keyword = search?.keyword ?? "";
		const isSearch = keyword.trim().length > 0;
		// 默认主列表（无关键词）可被边缘共享缓存；带关键词的搜索结果私有缓存 5 分钟。
		return {
			"Cache-Control": isSearch
				? "private, max-age=0, s-maxage=300, stale-while-revalidate=3600"
				: "public, max-age=120, s-maxage=1800, stale-while-revalidate=7200",
		};
	},
	loader: async ({ context, deps }) => {
		const typeValue = typeLabelToValue[deps.type];
		const isAll = typeValue === "all";
		const isSearch = deps.keyword.trim().length > 0;

		if (isSearch) {
			return context.queryClient.ensureQueryData(
				searchSubjectsQueryOptions({
					keyword: deps.keyword,
					sort: "rank",
					filter: !isAll
						? { type: [Number(typeValue) as SubjectType] }
						: undefined,
					limit: PAGE_SIZE,
				}),
			);
		}
		return context.queryClient.ensureQueryData(
			browseSubjectsQueryOptions({
				type: (!isAll ? Number(typeValue) : SubjectType.Anime) as SubjectType,
				sort: "rank",
				limit: PAGE_SIZE,
			}),
		);
	},
	head: ({ match }) => {
		const search = match.search as
			| { keyword?: string; type?: string }
			| undefined;
		const keyword = search?.keyword ?? "";
		const type = search?.type ?? ALL_LABEL;
		const isSearch = keyword.trim().length > 0;

		const title = keyword.trim()
			? `搜索「${keyword}」 - 条目`
			: type !== ALL_LABEL
				? `${type}条目排行`
				: "条目排行";
		const description = keyword.trim()
			? `在 Bangumi X 上搜索「${keyword}」相关的条目，包含动画、漫画、游戏、音乐等。`
			: `Bangumi X ${type !== ALL_LABEL ? type : "动画"}排行：基于番组计划数据按排名展示热门条目，支持按类型筛选与全文检索。`;

		// keyword 搜索结果 noindex（避免无限组合参数收录）；纯类型筛选页可索引。
		const { meta, links } = buildMeta({
			title,
			description,
			path: "/subjects",
			noindex: isSearch,
		});

		return {
			meta,
			links,
			...serializeJsonLd(
				breadcrumbJsonLd([
					{ name: "首页", path: "/" },
					{ name: "条目", path: "/subjects" },
				]),
			),
		};
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
					<SubjectCardSkeleton key={`sk-${i}`} />
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
	const typeValue = typeLabelToValue[type];
	const isAll = typeValue === "all";
	const filter = !isAll
		? { type: [Number(typeValue) as SubjectType] }
		: undefined;

	const queryKey = isSearching
		? ([
				"subjects",
				"search",
				{ keyword, sort: "rank", filter, limit: PAGE_SIZE },
			] as const)
		: ([
				"subjects",
				"browse",
				{ type: typeValue, sort: "rank", limit: PAGE_SIZE },
			] as const);

	const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
		useInfiniteQuery({
			queryKey,
			queryFn: async ({ pageParam = 0 }) => {
				if (isSearching) {
					return searchSubjects({
						data: {
							keyword,
							sort: "rank",
							filter,
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
		<article>
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
						<SubjectCardSkeleton key={`sk-${i}`} />
					))}
				</div>
			) : subjects.length === 0 ? (
				<EmptyState
					title="没有找到条目"
					description={isSearching ? "请尝试其他关键词" : "暂无数据"}
				/>
			) : (
				<>
					<ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 list-none p-0 m-0">
						{subjects.map((s) => (
							<li key={s.id}>
								<SubjectCard
									id={s.id}
									name={s.name}
									nameCn={s.name_cn}
									image={s.images?.large || s.images?.common}
									score={s.rating?.score ?? 0}
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
