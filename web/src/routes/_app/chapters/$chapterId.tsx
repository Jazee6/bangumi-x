import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, useRouter } from "@tanstack/react-router";
import { isIndexableChapter, PUBLICATION, type SourceMetadata } from "share";

import { chapterQueryOptions } from "@/features/chapters/chapter-query";
import { ChapterError, ChapterLoading } from "@/features/chapters/chapter-states";
import { ChapterView } from "@/features/chapters/chapter-view";
import { ApiRequestError } from "@/lib/api-error";
import {
  buildBreadcrumbJsonLd,
  buildChapterJsonLd,
  buildPageHead,
  CACHE_CONTROL,
  getChapterBreadcrumbs,
  NOT_FOUND_HEADERS,
} from "@/lib/seo";

export const Route = createFileRoute("/_app/chapters/$chapterId")({
  beforeLoad: ({ params }) => {
    const id = Number(params.chapterId);
    if (!Number.isInteger(id) || id <= 0) {
      throw notFound({ headers: NOT_FOUND_HEADERS });
    }
  },
  loader: async ({ context, params }) => {
    try {
      const chapter = await context.queryClient.query({
        ...chapterQueryOptions(params.chapterId),
        staleTime: "static",
      });
      const source: SourceMetadata | undefined = chapter.fetchedAt
        ? { url: `https://bgm.tv/ep/${chapter.id}`, fetchedAt: chapter.fetchedAt }
        : undefined;
      return { chapter, subject: chapter.subject, source };
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) {
        throw notFound({ headers: NOT_FOUND_HEADERS });
      }
      throw error;
    }
  },
  headers: ({ loaderData }) => {
    if (!loaderData) return NOT_FOUND_HEADERS;
    const { chapter, subject } = loaderData;
    if (!isIndexableChapter(chapter, subject)) {
      return {
        "X-Robots-Tag": "noindex, follow",
        "Cache-Control": CACHE_CONTROL.thin,
      };
    }
    return { "Cache-Control": CACHE_CONTROL.detail };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return buildPageHead({ publication: { state: "not-found", reason: "invalid-chapter" } });
    }
    const { chapter, subject } = loaderData;
    const publication = isIndexableChapter(chapter, subject)
      ? PUBLICATION.index("chapter")
      : PUBLICATION.noindexFollow(
          subject.nsfw
            ? "nsfw_subject"
            : chapter.title === "未命名章节"
              ? "unnamed_chapter"
              : "thin_chapter",
        );

    const description =
      chapter.summary?.trim() ||
      `${subject.title} 章节「${chapter.title}」${chapter.date ? `，日期 ${chapter.date}` : ""}${chapter.duration ? `，时长 ${chapter.duration}` : ""}。`;

    return buildPageHead({
      title: `${chapter.title} - ${subject.title}`,
      description,
      canonicalPath: `/chapters/${params.chapterId}`,
      imagePath: `/og/chapters/${params.chapterId}`,
      publication,
      jsonLd: [
        buildBreadcrumbJsonLd(getChapterBreadcrumbs(chapter, subject)),
        buildChapterJsonLd(chapter, subject),
      ],
    });
  },
  pendingComponent: ChapterLoading,
  errorComponent: ChapterRouteError,
  component: ChapterPage,
});

function ChapterPage() {
  const { chapter } = Route.useLoaderData();
  const { data } = useSuspenseQuery(chapterQueryOptions(chapter.id.toString()));
  return <ChapterView chapter={data} />;
}

function ChapterRouteError({ error }: { error: unknown }) {
  const router = useRouter();
  const routeError = error instanceof Error ? error : new Error("章节暂时无法加载。");
  const retryable = !(routeError instanceof ApiRequestError && routeError.status < 500);

  return (
    <ChapterError error={routeError} retryable={retryable} onRetry={() => router.invalidate()} />
  );
}
