import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound, stripSearchParams } from "@tanstack/react-router";
import {
  getCurrentYear,
  SUBJECT_TYPE_FILTER_LABELS,
  SUBJECT_TYPE_FILTER_VALUES,
  type SourceMetadata,
  type SubjectTypeFilter,
} from "share";

import { HeaderTitle } from "@/components/app-shell";
import { KeywordSearchForm } from "@/components/keyword-search-form";
import { CrawlNavigation } from "@/components/crawl-navigation";
import {
  DiscoveryEmpty,
  DiscoveryError,
  DiscoveryLoading,
} from "@/features/discovery/discovery-states";
import {
  discoverCharactersQueryOptions,
  discoverPersonsQueryOptions,
  discoverSubjectsQueryOptions,
} from "@/features/discovery/discovery-query";
import {
  DiscoveryCharacters,
  DiscoveryControls,
  DiscoveryPersons,
  DiscoverySubjects,
} from "@/features/discovery/discovery-view";
import {
  DEFAULT_DISCOVER_SEARCH,
  validateDiscoverSearch,
  type DiscoverTab,
} from "@/features/discovery/discovery-search";
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildPageHead,
  CACHE_CONTROL,
  NOT_FOUND_HEADERS,
} from "@/lib/seo";

function getDiscoverSourceUrl(
  tab: DiscoverTab,
  type: SubjectTypeFilter,
  year: number,
  keyword?: string,
) {
  const query = encodeURIComponent(keyword ?? "");
  if (tab === "characters") return `https://bgm.tv/character_search/${query}`;
  if (tab === "persons") return `https://bgm.tv/person_search/${query}`;
  return keyword
    ? `https://bgm.tv/subject_search/${query}`
    : `https://bgm.tv/${type}/browser?sort=rank&year=${year}`;
}

export const Route = createFileRoute("/_app/discover/$type")({
  validateSearch: validateDiscoverSearch,
  search: { middlewares: [stripSearchParams(DEFAULT_DISCOVER_SEARCH)] },
  beforeLoad: ({ params }) => {
    if (!SUBJECT_TYPE_FILTER_VALUES.includes(params.type as SubjectTypeFilter)) {
      throw notFound({
        headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
      });
    }
  },
  loaderDeps: ({ search }) => ({
    page: search.page,
    keyword: search.keyword,
    tab: search.tab,
  }),
  loader: async ({ context, deps, params }) => {
    const type = params.type as SubjectTypeFilter;
    const year = getCurrentYear();
    const { queryClient } = context;
    // 角色和人物只有搜索结果；数据加载失败时交给页面内的错误状态重试。
    const data: { pages?: Array<{ fetchedAt?: string }> } | undefined = await (
      deps.tab === "subjects"
        ? queryClient.infiniteQuery({
            ...discoverSubjectsQueryOptions(type, year, deps.keyword, deps.page),
            staleTime: "static",
          })
        : !deps.keyword
          ? Promise.resolve(undefined)
          : deps.tab === "characters"
            ? queryClient.infiniteQuery({
                ...discoverCharactersQueryOptions(deps.keyword, deps.page),
                staleTime: "static",
              })
            : queryClient.infiniteQuery({
                ...discoverPersonsQueryOptions(deps.keyword, deps.page),
                staleTime: "static",
              })
    ).catch(() => undefined);
    const fetchedAt = data?.pages?.at(-1)?.fetchedAt;
    const source: SourceMetadata | undefined = fetchedAt
      ? { url: getDiscoverSourceUrl(deps.tab, type, year, deps.keyword), fetchedAt }
      : undefined;
    return { year, type, page: deps.page, keyword: deps.keyword, tab: deps.tab, source, data };
  },
  headers: ({ match }): Record<string, string> => {
    if (!SUBJECT_TYPE_FILTER_VALUES.includes(match.params.type as SubjectTypeFilter)) {
      return NOT_FOUND_HEADERS;
    }
    if (match.search.keyword) {
      return {
        "X-Robots-Tag": "noindex, follow",
        "Cache-Control": "private, no-store, max-age=0",
      };
    }
    return { "Cache-Control": CACHE_CONTROL.directory };
  },
  head: ({ loaderData, params }) => {
    if (!SUBJECT_TYPE_FILTER_VALUES.includes(params.type as SubjectTypeFilter) || !loaderData) {
      return buildPageHead({ publication: { state: "not-found", reason: "invalid-type" } });
    }
    const type = loaderData.type as SubjectTypeFilter;
    const search = {
      page: loaderData?.page ?? 1,
      keyword: loaderData?.keyword,
      tab: loaderData?.tab ?? "subjects",
    };
    const label = SUBJECT_TYPE_FILTER_LABELS[type] ?? "发现";
    const searchParams = new URLSearchParams();
    if (search.keyword) searchParams.set("keyword", search.keyword);
    if (search.page > 1) searchParams.set("page", String(search.page));
    if (search.tab !== "subjects") searchParams.set("tab", search.tab);
    const query = searchParams.toString();
    const path = `/discover/${params.type}${query ? `?${query}` : ""}`;
    const keyword = search.keyword;
    return buildPageHead({
      title: keyword
        ? `搜索「${keyword}」的${label}结果`
        : `${loaderData?.year ?? getCurrentYear()} 年度热门${label}${search.page > 1 ? `（第 ${search.page} 页）` : ""}`,
      description: keyword
        ? `搜索 Bangumi X 中的${label}条目。`
        : `浏览 ${loaderData?.year ?? getCurrentYear()} 年度热门${label}，按 Bangumi 全站排名整理。`,
      canonicalPath: path,
      image: keyword ? null : undefined,
      publication: keyword
        ? { state: "noindex-follow", reason: "keyword-search" }
        : { state: "index", reason: "annual-popular" },
      jsonLd: [
        buildBreadcrumbJsonLd([
          { name: "首页", path: "/" },
          { name: label, path: `/discover/${type}` },
        ]),
        buildItemListJsonLd(
          search.tab === "subjects"
            ? ((
                loaderData?.data as
                  | {
                      pages?: Array<{
                        data: Array<{ id: number; title: string; imageUrl?: string | null }>;
                      }>;
                    }
                  | undefined
              )?.pages?.at(-1)?.data ?? [])
            : [],
        ),
      ],
    });
  },
  component: DiscoverTypePage,
});

function DiscoverTypePage() {
  const { year, type, page, keyword, tab } = Route.useLoaderData()!;
  const navigate = Route.useNavigate();
  const subjectQuery = useInfiniteQuery({
    ...discoverSubjectsQueryOptions(type, year, keyword, page),
    enabled: tab === "subjects",
  });
  const characterQuery = useInfiniteQuery({
    ...discoverCharactersQueryOptions(keyword ?? "", page),
    enabled: tab === "characters" && Boolean(keyword),
  });
  const personQuery = useInfiniteQuery({
    ...discoverPersonsQueryOptions(keyword ?? "", page),
    enabled: tab === "persons" && Boolean(keyword),
  });
  const query =
    tab === "subjects" ? subjectQuery : tab === "characters" ? characterQuery : personQuery;
  const lastPage = (query.data as { pages?: Array<{ hasNext: boolean }> } | undefined)?.pages?.at(
    -1,
  );
  const pagePath = (nextPage: number) => {
    const search = new URLSearchParams();
    if (keyword) search.set("keyword", keyword);
    if (tab !== "subjects") search.set("tab", tab);
    if (nextPage > 1) search.set("page", String(nextPage));
    const queryString = search.toString();
    return `/discover/${type}${queryString ? `?${queryString}` : ""}`;
  };

  return (
    <div className="mx-auto w-full p-4 sm:p-6">
      <HeaderTitle className="text-3xl font-semibold tracking-tight">发现</HeaderTitle>
      <DiscoveryControls
        tab={tab}
        type={type}
        onTabChange={(nextTab) =>
          void navigate({
            search: { tab: nextTab, ...(keyword ? { keyword } : {}), page: 1 },
            resetScroll: false,
          })
        }
        onTypeChange={(nextType) =>
          void navigate({
            to: "/discover/$type",
            params: { type: nextType },
            search: { tab, ...(keyword ? { keyword } : {}), page: 1 },
            resetScroll: false,
          })
        }
      />
      <KeywordSearchForm
        className="mt-2"
        label="搜索关键词"
        placeholder="输入关键词"
        allowEmpty
        keyword={keyword}
        searching={query.isFetching}
        onSubmit={(value) =>
          void navigate({
            search: { tab, ...(value ? { keyword: value } : {}), page: 1 },
            resetScroll: false,
          })
        }
      />
      {tab !== "subjects" && !keyword && <DiscoveryEmpty kind="unsearched" />}
      {tab === "subjects" && query.isPending && <DiscoveryLoading />}
      {tab !== "subjects" && keyword && query.isPending && <DiscoveryLoading entity />}
      {query.isError && !query.data && (tab === "subjects" || Boolean(keyword)) && (
        <DiscoveryError
          message={query.error.message}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      )}
      {tab === "subjects" && subjectQuery.data && (
        <DiscoverySubjects
          pages={subjectQuery.data.pages}
          state={subjectQuery}
          searched={Boolean(keyword)}
        />
      )}
      {tab === "characters" && characterQuery.data && (
        <DiscoveryCharacters pages={characterQuery.data.pages} state={characterQuery} />
      )}
      {tab === "persons" && personQuery.data && (
        <DiscoveryPersons pages={personQuery.data.pages} state={personQuery} />
      )}
      <CrawlNavigation aria-label="条目类型导航" className="mt-8 flex flex-wrap gap-4 text-sm">
        {SUBJECT_TYPE_FILTER_VALUES.map((value) => (
          <Link
            key={value}
            to="/discover/$type"
            params={{ type: value }}
            search={{ tab: "subjects", page: 1 }}
            className="underline-offset-4 hover:underline"
          >
            {SUBJECT_TYPE_FILTER_LABELS[value]}
          </Link>
        ))}
      </CrawlNavigation>
      <CrawlNavigation aria-label="分页导航" className="mt-8 flex justify-between gap-4 text-sm">
        {page > 1 ? (
          <a href={pagePath(page - 1)} rel="prev" className="underline-offset-4 hover:underline">
            上一页
          </a>
        ) : (
          <span />
        )}
        {lastPage?.hasNext && (
          <a href={pagePath(page + 1)} rel="next" className="underline-offset-4 hover:underline">
            下一页
          </a>
        )}
      </CrawlNavigation>
    </div>
  );
}
