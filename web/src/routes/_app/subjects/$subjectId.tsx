import { useInfiniteQuery, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Link,
  notFound,
  Outlet,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import type { SourceMetadata } from "share";

import { routeTabClassName, RouteTabs } from "@/components/route-tabs";
import { subjectCharactersQueryOptions } from "@/features/characters/character-query";
import { chapterListQueryOptions } from "@/features/chapters/chapter-query";
import { subjectPersonsQueryOptions } from "@/features/persons/person-query";
import { subjectQueryOptions } from "@/features/subjects/subject-query";
import { SubjectError, SubjectLoading } from "@/features/subjects/subject-states";
import { SubjectView } from "@/features/subjects/subject-view";
import { ApiRequestError } from "@/lib/api-error";
import { CACHE_CONTROL, NOT_FOUND_HEADERS } from "@/lib/seo";

export const Route = createFileRoute("/_app/subjects/$subjectId")({
  validateSearch: (search: Record<string, unknown>) =>
    search.collect === true || search.collect === "true" ? { collect: true as const } : {},
  beforeLoad: ({ params }) => {
    const id = Number(params.subjectId);
    if (!Number.isInteger(id) || id <= 0) {
      throw notFound({ headers: NOT_FOUND_HEADERS });
    }
  },
  loader: async ({ context, params }) => {
    try {
      const subject = await context.queryClient.query({
        ...subjectQueryOptions(params.subjectId),
        staleTime: "static",
      });
      const source: SourceMetadata | undefined = subject.fetchedAt
        ? { url: `https://bgm.tv/subject/${subject.id}`, fetchedAt: subject.fetchedAt }
        : undefined;
      return { subject, source };
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 404) {
        throw notFound({ headers: NOT_FOUND_HEADERS });
      }
      throw error;
    }
  },
  headers: () => ({
    "Cache-Control": CACHE_CONTROL.detail,
  }),
  pendingComponent: () => <SubjectLoading tab="chapters" />,
  errorComponent: SubjectRouteError,
  component: SubjectLayout,
});

function SubjectLayout() {
  const { subjectId } = Route.useParams();
  const { data: subject } = useSuspenseQuery(subjectQueryOptions(subjectId));
  const chapterQuery = useInfiniteQuery({
    ...chapterListQueryOptions(subjectId),
    enabled: false,
  });
  const characterQuery = useQuery({
    ...subjectCharactersQueryOptions(subjectId),
    enabled: false,
  });
  const personQuery = useQuery({
    ...subjectPersonsQueryOptions(subjectId),
    enabled: false,
  });
  const chapterCount = chapterQuery.data?.pages[0]?.total ?? subject.totalChapters;
  const { collect } = Route.useSearch();
  const navigate = Route.useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });

  const activeTab = pathname.startsWith(`/subjects/${subjectId}/characters`)
    ? "characters"
    : pathname.startsWith(`/subjects/${subjectId}/persons`)
      ? "persons"
      : "chapters";

  return (
    <SubjectView
      subject={subject}
      openCollection={collect}
      onCollectionIntentConsumed={() =>
        void navigate({
          search: (previous) => ({ ...previous, collect: undefined }),
          replace: true,
          resetScroll: false,
        })
      }
    >
      <RouteTabs aria-label="条目关联导航" className="mt-6">
        <Link
          to="/subjects/$subjectId"
          params={{ subjectId }}
          activeOptions={{ exact: true }}
          resetScroll={false}
          aria-current={activeTab === "chapters" ? "page" : undefined}
          className={routeTabClassName}
        >
          章节
          {chapterCount !== null && (
            <span className="text-muted-foreground tabular-nums">{chapterCount}</span>
          )}
        </Link>
        <Link
          to="/subjects/$subjectId/characters"
          params={{ subjectId }}
          resetScroll={false}
          aria-current={activeTab === "characters" ? "page" : undefined}
          className={routeTabClassName}
        >
          角色
          {characterQuery.data && (
            <span className="text-muted-foreground tabular-nums">{characterQuery.data.total}</span>
          )}
        </Link>
        <Link
          to="/subjects/$subjectId/persons"
          params={{ subjectId }}
          resetScroll={false}
          aria-current={activeTab === "persons" ? "page" : undefined}
          className={routeTabClassName}
        >
          人物
          {personQuery.data && (
            <span className="text-muted-foreground tabular-nums">{personQuery.data.total}</span>
          )}
        </Link>
      </RouteTabs>

      <div className="mt-4">
        <Outlet />
      </div>
    </SubjectView>
  );
}

function SubjectRouteError({ error }: { error: unknown }) {
  const router = useRouter();
  const routeError = error instanceof Error ? error : new Error("条目暂时无法加载。");
  const retryable = !(routeError instanceof ApiRequestError && routeError.status < 500);

  return (
    <SubjectError error={routeError} retryable={retryable} onRetry={() => router.invalidate()} />
  );
}
