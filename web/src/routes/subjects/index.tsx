import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import * as v from "valibot";
import { EmptyState } from "@/components/empty-state.tsx";
import { InfiniteScroll } from "@/components/infinite-scroll.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { SubjectCardSkeleton } from "@/components/skeletons/subject-card-skeleton.tsx";
import { SubjectCard } from "@/components/subject-card.tsx";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select.tsx";
import { Skeleton } from "@/components/ui/skeleton.tsx";
import { Typography } from "@/components/ui/typography.tsx";
import { buildMeta } from "@/lib/seo/site.ts";
import { browseSubjects, searchSubjects } from "@/server/functions.ts";
import type { PagedResponse, Subject } from "@/types";
import { SubjectType, SubjectTypeLabel } from "@/types";

const ALL_LABEL = "全部";
const ALL_VALUE = "all";
const typeOptions = [
  { value: ALL_VALUE, label: ALL_LABEL },
  ...Object.entries(SubjectTypeLabel).map(([v, l]) => ({ value: v, label: l })),
];
const typeValueToLabel = Object.fromEntries(typeOptions.map((o) => [o.value, o.label]));

const PAGE_SIZE = 20;

const searchSchema = v.object({
  keyword: v.optional(v.string()),
  type: v.optional(v.string()),
});

export const Route = createFileRoute("/subjects/")({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => ({
    keyword: search.keyword ?? "",
    type: search.type ?? ALL_VALUE,
  }),
  headers: ({ match }) => {
    const search = v.parse(searchSchema, match.search);
    const keyword = search.keyword ?? "";
    const isSearch = keyword.trim().length > 0;
    return {
      "Cache-Control": isSearch
        ? "private, max-age=0, s-maxage=300, stale-while-revalidate=3600"
        : "public, max-age=120, s-maxage=1800, stale-while-revalidate=7200",
    };
  },
  loader: async ({ deps }) => {
    const typeValue = deps.type;
    const isAll = typeValue === ALL_VALUE;
    const isSearch = deps.keyword.trim().length > 0;

    if (isSearch) {
      return searchSubjects({
        data: {
          keyword: deps.keyword,
          sort: "rank",
          filter: !isAll ? { type: [Number(typeValue) as SubjectType] } : undefined,
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
  head: ({ match }) => {
    const search = v.parse(searchSchema, match.search);
    const keyword = search.keyword ?? "";
    const typeValue = search.type ?? ALL_VALUE;
    const typeLabel = typeValueToLabel[typeValue] ?? ALL_LABEL;
    const isSearch = keyword.trim().length > 0;

    const title = keyword.trim()
      ? `搜索「${keyword}」 - 条目`
      : typeValue !== ALL_VALUE
        ? `${typeLabel}条目排行`
        : "条目排行";
    const description = keyword.trim()
      ? `在 Bangumi X 上搜索「${keyword}」相关的条目，包含动画、漫画、游戏、音乐等。`
      : `Bangumi X ${typeValue !== ALL_VALUE ? typeLabel : "动画"}排行：基于番组计划数据按排名展示热门条目，支持按类型筛选与全文检索。`;

    return {
      meta: buildMeta({
        title,
        description,
        noindex: isSearch,
      }),
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
          <SubjectCardSkeleton key={`sk-${i}`} />
        ))}
      </div>
    </div>
  ),
  component: SubjectsPage,
});

function SubjectsPage() {
  const initialData = Route.useLoaderData();
  const search = Route.useSearch();
  const keyword = search.keyword ?? "";
  const typeValue = search.type ?? ALL_VALUE;
  const navigate = useNavigate();

  const updateSearch = useCallback(
    (updates: Partial<{ keyword: string; type: string }>) => {
      const next = { keyword, type: typeValue, ...updates };
      navigate({
        to: ".",
        search: {
          keyword: next.keyword || undefined,
          type: next.type === ALL_VALUE ? undefined : next.type,
        },
      });
    },
    [navigate, keyword, typeValue],
  );

  const isSearching = keyword.trim().length > 0;
  const isAll = typeValue === ALL_VALUE;
  const filter = !isAll ? { type: [Number(typeValue) as SubjectType] } : undefined;

  const queryKey = isSearching
    ? (["subjects", "search", { keyword, sort: "rank", filter, limit: PAGE_SIZE }] as const)
    : (["subjects", "browse", { type: typeValue, sort: "rank", limit: PAGE_SIZE }] as const);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }): Promise<PagedResponse<Subject>> => {
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
          type: (!isAll ? Number(typeValue) : SubjectType.Anime) as SubjectType,
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
    initialData: initialData ? { pages: [initialData], pageParams: [0] } : undefined,
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
          <SearchInput value={keyword} onSearch={handleSearch} placeholder="搜索条目..." />
        </div>
        <Select value={typeValue} onValueChange={(v) => updateSearch({ type: v ?? ALL_VALUE })}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="类型" />
          </SelectTrigger>
          <SelectContent>
            {typeOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {Array.from({ length: PAGE_SIZE }).map((_, i) => (
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
