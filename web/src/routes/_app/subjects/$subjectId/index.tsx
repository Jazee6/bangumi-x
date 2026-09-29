import { useInfiniteQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { isIndexableSubject, PUBLICATION } from "share";

import { CrawlNavigation } from "@/components/crawl-navigation";
import { ChapterList } from "@/features/chapters/chapter-list";
import { chapterListQueryOptions } from "@/features/chapters/chapter-query";
import { subjectQueryOptions } from "@/features/subjects/subject-query";
import {
  buildBreadcrumbJsonLd,
  buildPageHead,
  buildSubjectChaptersJsonLd,
  buildSubjectJsonLd,
  CACHE_CONTROL,
  coverShareImage,
  getSubjectBreadcrumbs,
} from "@/lib/seo";
import { validatePageSearch } from "@/lib/search-params";

export const Route = createFileRoute("/_app/subjects/$subjectId/")({
  validateSearch: validatePageSearch,
  search: { middlewares: [stripSearchParams({ page: 1 })] },
  loaderDeps: ({ search }) => ({ page: search.page ?? 1 }),
  loader: async ({ context, deps, params }) => {
    const [subject, chapters] = await Promise.all([
      context.queryClient.query({
        ...subjectQueryOptions(params.subjectId),
        staleTime: "static",
      }),
      context.queryClient.infiniteQuery({
        ...chapterListQueryOptions(params.subjectId, deps.page),
        staleTime: "static",
      }),
    ]);
    return { subject, chapters, page: deps.page };
  },
  headers: ({ loaderData }): Record<string, string> => {
    if (loaderData?.subject && !isIndexableSubject(loaderData.subject)) {
      return {
        "X-Robots-Tag": "noindex, follow",
        "Cache-Control": CACHE_CONTROL.thin,
      };
    }
    return {
      "Cache-Control": CACHE_CONTROL.detail,
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return buildPageHead({
        canonicalPath: `/subjects/${params.subjectId}`,
      });
    }
    const { subject, chapters, page } = loaderData;
    const publication = isIndexableSubject(subject)
      ? PUBLICATION.index("subject")
      : PUBLICATION.noindexFollow(subject.nsfw ? "nsfw" : "unnamed");
    const pageSuffix = page > 1 ? `（章节第 ${page} 页）` : "";
    const canonicalPath = `/subjects/${params.subjectId}${page > 1 ? `?page=${page}` : ""}`;
    const currentPageItems = chapters.pages.at(-1)?.data ?? [];

    return buildPageHead({
      title: `${subject.title}（${subject.type}）${pageSuffix}`,
      description:
        subject.summary?.trim() ||
        `${subject.title}（${subject.type}）${subject.date ? `，首播/发售日期 ${subject.date}` : ""}${subject.score ? `，评分 ${subject.score}` : ""}。`,
      canonicalPath,
      image: coverShareImage(subject.imageUrl, subject.nsfw),
      publication,
      jsonLd: [
        buildBreadcrumbJsonLd(getSubjectBreadcrumbs(subject)),
        buildSubjectJsonLd(subject),
        buildSubjectChaptersJsonLd(subject, currentPageItems, page),
      ],
    });
  },
  component: SubjectChaptersPage,
});

function SubjectChaptersPage() {
  const { subjectId } = Route.useParams();
  const loaderData = Route.useLoaderData();
  const page = loaderData?.page ?? 1;
  const query = useInfiniteQuery(chapterListQueryOptions(subjectId, page));
  const lastPage = query.data?.pages.at(-1);

  const pagePath = (nextPage: number) =>
    `/subjects/${subjectId}${nextPage > 1 ? `?page=${nextPage}` : ""}`;

  return (
    <div>
      <ChapterList query={query} />
      <CrawlNavigation aria-label="分页导航" className="mt-8 flex justify-between gap-4 text-sm">
        {page > 1 ? (
          <a href={pagePath(page - 1)} rel="prev" className="underline-offset-4 hover:underline">
            上一页
          </a>
        ) : (
          <span />
        )}
        {lastPage && lastPage.offset + lastPage.limit < lastPage.total && (
          <a href={pagePath(page + 1)} rel="next" className="underline-offset-4 hover:underline">
            下一页
          </a>
        )}
      </CrawlNavigation>
    </div>
  );
}
