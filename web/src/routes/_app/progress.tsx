import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import { PROGRESS_STAGE_LABELS, PROGRESS_STAGE_VALUES } from "share";
import type { ProgressStage } from "share";

import { HeaderTitle } from "@/components/app-shell";
import { KeywordSearchForm } from "@/components/keyword-search-form";
import { SignInEmpty } from "@/components/sign-in";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { personalRecordCountsQueryOptions } from "@/features/collections/collections-query";
import { progressRecordsQueryOptions } from "@/features/progress/progress-query";
import {
  DEFAULT_PROGRESS_SEARCH,
  validateProgressSearch,
  type ProgressSearch,
} from "@/features/progress/progress-search";
import { ProgressError, ProgressList, ProgressLoading } from "@/features/progress/progress-view";
import { useHydratedSession } from "@/lib/auth-client";
import { buildPageHead, PRIVATE_HEADERS } from "@/lib/seo";

export const Route = createFileRoute("/_app/progress")({
  head: () =>
    buildPageHead({
      title: "个人进度",
      description: "管理你的 Bangumi X 私人观看与阅读进度。",
      canonicalPath: "/progress",
      publication: { state: "noindex-nofollow", reason: "private-user-state" },
    }),
  headers: () => PRIVATE_HEADERS,
  validateSearch: validateProgressSearch,
  search: { middlewares: [stripSearchParams(DEFAULT_PROGRESS_SEARCH)] },
  component: ProgressPage,
});

function ProgressSessionLoading() {
  return (
    <div aria-busy="true">
      <Skeleton shape="control" className="mt-4 h-9 w-full" />
      <div className="mt-4 overflow-hidden pb-1">
        <Skeleton shape="pill" className="h-9 w-64" />
      </div>
      <ProgressLoading />
    </div>
  );
}

function ProgressPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const { data: session, isPending: sessionPending } = useHydratedSession();
  const records = useInfiniteQuery({
    ...progressRecordsQueryOptions(search),
    enabled: Boolean(session),
  });
  const counts = useQuery({
    ...personalRecordCountsQueryOptions,
    enabled: Boolean(session),
  });

  function updateSearch(patch: Partial<ProgressSearch>) {
    const next = { ...search, ...patch };
    if (!next.keyword) delete next.keyword;
    void navigate({ search: next, resetScroll: false });
  }

  return (
    <div className="mx-auto w-full p-4 sm:p-6">
      <HeaderTitle className="text-3xl font-semibold tracking-tight">进度</HeaderTitle>

      {sessionPending && <ProgressSessionLoading />}
      {!sessionPending && !session && (
        <SignInEmpty
          title="登录后查看进度"
          description="登录后可记录和管理你的条目进度。"
          returnTo="/progress"
        />
      )}

      {session && (
        <>
          <KeywordSearchForm
            className="mt-4"
            label="搜索进度"
            placeholder="搜索标题"
            keyword={search.keyword}
            searching={records.isFetching}
            onSubmit={(keyword) => updateSearch({ keyword })}
            onClear={() => updateSearch({ keyword: undefined })}
          />

          <div className="mt-4 overflow-x-auto pb-1">
            <Tabs
              value={search.stage}
              onValueChange={(value) => updateSearch({ stage: value as ProgressStage })}
            >
              <TabsList aria-label="进度阶段">
                {PROGRESS_STAGE_VALUES.map((stage) => (
                  <TabsTrigger key={stage} value={stage}>
                    {PROGRESS_STAGE_LABELS[stage]}{" "}
                    <span className="text-muted-foreground tabular-nums">
                      {counts.data?.progress[stage] ?? 0}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {records.isPending && <ProgressLoading />}
          {records.isError && !records.data && (
            <ProgressError
              message={records.error.message}
              retrying={records.isFetching}
              onRetry={() => void records.refetch()}
            />
          )}
          {records.data && (
            <ProgressList
              pages={records.data.pages}
              stage={search.stage}
              keyword={search.keyword}
              state={records}
            />
          )}
        </>
      )}
    </div>
  );
}
