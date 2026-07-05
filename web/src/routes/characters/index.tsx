import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback } from "react";
import * as v from "valibot";
import { EmptyState } from "@/components/empty-state.tsx";
import { InfiniteScroll } from "@/components/infinite-scroll.tsx";
import { CharacterPersonCard } from "@/components/character-person-card.tsx";
import { SearchInput } from "@/components/search-input.tsx";
import { CharacterPersonCardSkeleton } from "@/components/skeletons/character-person-card-skeleton.tsx";
import { Typography } from "@/components/ui/typography.tsx";
import { buildMeta } from "@/lib/seo/site.ts";
import { searchCharacters } from "@/server/functions.ts";
import type { Character, PagedResponse } from "@/types";

const PAGE_SIZE = 20;

const searchSchema = v.object({
  keyword: v.optional(v.string()),
});

export const Route = createFileRoute("/characters/")({
  validateSearch: searchSchema,
  headers: () => ({
    "Cache-Control": "private, max-age=0, s-maxage=300, stale-while-revalidate=3600",
  }),
  head: ({ match }) => {
    const { keyword: kw } = v.parse(searchSchema, match.search);
    const keyword = kw ?? "";
    const title = keyword ? `搜索「${keyword}」 - 角色` : "角色搜索";
    const description = keyword
      ? `在 Bangumi X 上搜索「${keyword}」相关角色。`
      : "Bangumi X 角色搜索：按关键词查询动画、漫画、游戏中的虚拟角色资料。";
    return buildMeta({
      title,
      description,
      url: "/characters",
      noindex: true,
    });
  },
  component: CharactersPage,
});

function CharactersPage() {
  const search = Route.useSearch();
  const keyword = search.keyword ?? "";
  const navigate = useNavigate();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useInfiniteQuery({
    queryKey: ["characters", "search", { keyword, limit: PAGE_SIZE }] as const,
    queryFn: async ({ pageParam = 0 }): Promise<PagedResponse<Character>> =>
      searchCharacters({
        data: { keyword, limit: PAGE_SIZE, offset: pageParam },
      }),
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
        <SearchInput value={keyword} onSearch={handleSearch} placeholder="搜索角色..." />
      </div>

      {!keyword.trim() ? (
        <EmptyState title="搜索角色" description="输入关键词开始搜索" />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <CharacterPersonCardSkeleton key={`sk-${i}`} />
          ))}
        </div>
      ) : characters.length === 0 ? (
        <EmptyState title="没有找到角色" description="请尝试其他关键词" />
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 list-none p-0 m-0">
            {characters.map((c) => (
              <li key={c.id}>
                <CharacterPersonCard
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
