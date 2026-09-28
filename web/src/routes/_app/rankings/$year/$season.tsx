import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, stripSearchParams, useRouter } from "@tanstack/react-router";
import {
  getCurrentSeason,
  getCurrentYear,
  isFutureSeason,
  RANKINGS_MIN_YEAR,
  SEASON_LABELS,
  SEASON_VALUES,
  type Season,
  type SourceMetadata,
} from "share";

import { HeaderTitle } from "@/components/app-shell";
import { CrawlNavigation } from "@/components/crawl-navigation";
import { DiscoveryError, DiscoveryLoading } from "@/features/discovery/discovery-states";
import { rankingsQueryOptions } from "@/features/rankings/rankings-query";
import { RankingsCollection, RankingsControls } from "@/features/rankings/rankings-view";
import {
  buildBreadcrumbJsonLd,
  buildItemListJsonLd,
  buildPageHead,
  CACHE_CONTROL,
  getRankingsBreadcrumbs,
  NOT_FOUND_HEADERS,
} from "@/lib/seo";
import { validatePageSearch } from "@/lib/search-params";

function getRankingParams(
  params: { year: string; season: string },
  now = new Date(),
): { year: number; season: Season } | null {
  const year = Number(params.year);
  const season = params.season as Season;
  return Number.isInteger(year) &&
    year >= RANKINGS_MIN_YEAR &&
    year <= getCurrentYear(now) &&
    SEASON_VALUES.includes(season) &&
    !isFutureSeason(year, season, now)
    ? { year, season }
    : null;
}

export const Route = createFileRoute("/_app/rankings/$year/$season")({
  validateSearch: validatePageSearch,
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  beforeLoad: ({ params }) => {
    if (!getRankingParams(params)) {
      throw notFound({
        headers: { "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
      });
    }
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ context, deps, params }) => {
    const year = Number(params.year);
    const season = params.season as Season;
    const page = deps.page;
    const data = await context.queryClient.infiniteQuery({
      ...rankingsQueryOptions(year, season, page),
      staleTime: "static",
    });
    const lastPage = data?.pages?.at(-1);
    const fetchedAt = lastPage?.fetchedAt;
    const source: SourceMetadata | undefined = fetchedAt
      ? {
          url: `https://bgm.tv/anime/browser?sort=rank&year=${year}`,
          fetchedAt,
        }
      : undefined;
    return { year, season, page, data, source };
  },
  headers: ({ match }): Record<string, string> => {
    if (!getRankingParams(match.params)) {
      return NOT_FOUND_HEADERS;
    }
    if (!match.loaderData) {
      return {
        "Cache-Control": "no-store",
      };
    }
    const data = match.loaderData.data;
    const items = data?.pages?.flatMap((p) => p.data) ?? [];
    if (items.length === 0) {
      return {
        "X-Robots-Tag": "noindex, follow",
        "Cache-Control": CACHE_CONTROL.thin,
      };
    }
    return {
      "Cache-Control": CACHE_CONTROL.directory,
    };
  },
  head: ({ loaderData, params }) => {
    const rankingParams = getRankingParams(params);
    if (!rankingParams || !loaderData) {
      return buildPageHead({
        publication: { state: "not-found", reason: "invalid-rankings-params" },
      });
    }
    const { year, season } = rankingParams;
    const page = loaderData.page;
    const seasonLabel = SEASON_LABELS[season] ?? season;
    const items = loaderData.data?.pages?.flatMap((p) => p.data) ?? [];
    const isEmpty = items.length === 0;
    const canonicalPath = `/rankings/${year}/${season}${page > 1 ? `?page=${page}` : ""}`;

    return buildPageHead({
      title: `${year} 年${seasonLabel}排行榜${page > 1 ? `（第 ${page} 页）` : ""}`,
      description: `浏览 ${year} 年${seasonLabel}动画排行榜，按 Bangumi 全站排名排列。`,
      canonicalPath,
      imagePath: `/og/rankings/${year}/${season}`,
      publication: isEmpty
        ? { state: "noindex-follow", reason: "empty-rankings" }
        : { state: "index", reason: "rankings" },
      jsonLd: [
        buildBreadcrumbJsonLd(getRankingsBreadcrumbs(year, season)),
        buildItemListJsonLd(items),
      ],
    });
  },
  errorComponent: RankingsRouteError,
  component: RankingsSeasonPage,
});

function RankingsSeasonPage() {
  const { year, season, page } = Route.useLoaderData();
  const navigate = Route.useNavigate();
  const query = useInfiniteQuery(rankingsQueryOptions(year, season, page));
  const lastPage = query.data?.pages?.at(-1);

  const pagePath = (nextPage: number) =>
    `/rankings/${year}/${season}${nextPage > 1 ? `?page=${nextPage}` : ""}`;

  return (
    <div className="mx-auto w-full p-4 sm:p-6">
      <HeaderTitle className="text-3xl font-semibold tracking-tight">排行榜</HeaderTitle>
      <RankingsControls
        year={year}
        season={season}
        onYearChange={(nextYear) => {
          const targetSeason = isFutureSeason(nextYear, season) ? getCurrentSeason() : season;
          void navigate({
            to: "/rankings/$year/$season",
            params: { year: nextYear.toString(), season: targetSeason },
            search: { page: 1 },
            resetScroll: false,
          });
        }}
      />

      {query.isPending && <DiscoveryLoading />}
      {query.isError && !query.data && (
        <DiscoveryError
          title="排行榜加载失败"
          message={query.error.message}
          retrying={query.isFetching}
          onRetry={() => void query.refetch()}
        />
      )}
      {query.data && <RankingsCollection pages={query.data.pages} state={query} />}

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

function RankingsRouteError({ error }: { error: unknown }) {
  const router = useRouter();
  const routeError = error instanceof Error ? error : new Error("排行榜暂时无法加载。");

  return (
    <div className="mx-auto w-full p-4 sm:p-6">
      <DiscoveryError
        title="排行榜加载失败"
        message={routeError.message}
        retrying={false}
        onRetry={() => router.invalidate()}
      />
    </div>
  );
}
