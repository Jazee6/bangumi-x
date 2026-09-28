import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, stripSearchParams, useRouter } from "@tanstack/react-router";
import { isIndexableCollectionList, PUBLICATION } from "share";

import { HeaderTitle } from "@/components/app-shell";
import { CrawlNavigation } from "@/components/crawl-navigation";
import { LocalDateTime } from "@/components/local-date-time";
import { publicCollectionListQueryOptions } from "@/features/collections/collections-query";
import { CollectionsError } from "@/features/collections/collections-view";
import { PublicCollectionListGrid } from "@/features/collections/public-collection-list-view";
import { ApiRequestError } from "@/lib/api-error";
import {
  buildBreadcrumbJsonLd,
  buildPageHead,
  buildPublicCollectionListJsonLd,
  NOT_FOUND_HEADERS,
} from "@/lib/seo";
import { validatePageSearch } from "@/lib/search-params";

export const Route = createFileRoute("/_app/s/$shareId")({
  validateSearch: validatePageSearch,
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  beforeLoad: ({ params }) => {
    if (!params.shareId || params.shareId.length > 128) {
      throw notFound({ headers: NOT_FOUND_HEADERS });
    }
  },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ context, deps, params }) => {
    try {
      const data = await context.queryClient.infiniteQuery({
        ...publicCollectionListQueryOptions(params.shareId, deps.page),
        staleTime: "static",
      });
      const currentPage = data.pages[0];
      if (!currentPage) throw notFound({ headers: NOT_FOUND_HEADERS });
      return { shareId: params.shareId, page: deps.page, data, currentPage };
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) {
        throw notFound({ headers: NOT_FOUND_HEADERS });
      }
      throw error;
    }
  },
  headers: ({ loaderData }) => {
    if (!loaderData) return NOT_FOUND_HEADERS;
    const qualified = isIndexableCollectionList(loaderData.currentPage);
    return {
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": qualified ? "index, follow" : "noindex, follow",
    };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return buildPageHead({ publication: PUBLICATION.notFound("collection-list-not-found") });
    }
    const { shareId, page, currentPage } = loaderData;
    const qualified = isIndexableCollectionList(currentPage);
    const canonicalPath = `/s/${shareId}${page > 1 ? `?page=${page}` : ""}`;
    const title = `${currentPage.name}${page > 1 ? `（第 ${page} 页）` : ""}`;
    const breadcrumbs = [
      { name: "首页", path: "/" },
      { name: currentPage.name, path: `/s/${shareId}` },
    ];
    return buildPageHead({
      title,
      description: `${currentPage.ownerName} 分享的公开收藏列表「${currentPage.name}」，共收录 ${currentPage.total} 个条目。`,
      canonicalPath,
      imagePath: `/og/collection-lists/${shareId}`,
      publication: qualified
        ? PUBLICATION.index("public-collection-list")
        : PUBLICATION.noindexFollow("insufficient-items"),
      jsonLd: [
        buildBreadcrumbJsonLd(breadcrumbs),
        ...(qualified
          ? [
              buildPublicCollectionListJsonLd({
                name: currentPage.name,
                shareId,
                page,
                total: currentPage.total,
                updatedAt: currentPage.updatedAt,
                items: currentPage.data,
              }),
            ]
          : []),
      ],
    });
  },
  errorComponent: SharedCollectionListError,
  component: SharedCollectionListPage,
});

function SharedCollectionListPage() {
  const { shareId, page, currentPage } = Route.useLoaderData();
  const query = useInfiniteQuery(publicCollectionListQueryOptions(shareId, page));
  const pagePath = (nextPage: number) => `/s/${shareId}${nextPage > 1 ? `?page=${nextPage}` : ""}`;
  return (
    <div className="mx-auto w-full p-4 sm:p-6">
      <HeaderTitle className="text-3xl font-semibold tracking-tight">
        {currentPage.name}
      </HeaderTitle>
      <p className="text-muted-foreground mt-2 text-sm">
        {`由 ${currentPage.ownerName} 分享`} · 更新于{" "}
        <LocalDateTime value={currentPage.updatedAt} />
      </p>

      <div className="mt-6">
        <PublicCollectionListGrid pages={query.data?.pages ?? [currentPage]} state={query} />
      </div>

      <CrawlNavigation aria-label="分页导航" className="mt-8 flex justify-between gap-4 text-sm">
        {page > 1 ? (
          <a href={pagePath(page - 1)} rel="prev" className="underline-offset-4 hover:underline">
            上一页
          </a>
        ) : (
          <span />
        )}
        {currentPage.hasNext && (
          <a href={pagePath(page + 1)} rel="next" className="underline-offset-4 hover:underline">
            下一页
          </a>
        )}
      </CrawlNavigation>
    </div>
  );
}

function SharedCollectionListError({ error }: { error: unknown }) {
  const router = useRouter();
  const routeError = error instanceof Error ? error : new Error("公开收藏列表暂时无法加载。");
  return (
    <div className="mx-auto w-full p-4 sm:p-6">
      <CollectionsError
        title="公开收藏列表加载失败"
        message={routeError.message}
        retrying={false}
        onRetry={() => void router.invalidate()}
      />
    </div>
  );
}
