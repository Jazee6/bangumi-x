import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";

import type { ProgressStage } from "share";

import { HeaderTitle } from "@/components/app-shell";
import { SignInEmpty } from "@/components/sign-in";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { personalRecordCountsQueryOptions } from "@/features/collections/collections-query";
import { progressRecordsQueryOptions } from "@/features/progress/progress-query";
import {
  DEFAULT_PROGRESS_SEARCH,
  validateProgressSearch,
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
      <div className="mt-4 overflow-hidden pb-1">
        <Skeleton shape="pill" className="h-9 w-48" />
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
    ...progressRecordsQueryOptions(search.stage),
    enabled: Boolean(session),
  });
  const counts = useQuery({
    ...personalRecordCountsQueryOptions,
    enabled: Boolean(session),
  });

  function setStage(stage: ProgressStage) {
    void navigate({ search: { stage }, resetScroll: false });
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
          <div className="mt-4 overflow-x-auto pb-1">
            <Tabs value={search.stage} onValueChange={(value) => setStage(value as ProgressStage)}>
              <TabsList aria-label="进度阶段">
                <TabsTrigger value="in_progress">
                  进行中{" "}
                  <span className="text-muted-foreground tabular-nums">
                    {counts.data?.progress.in_progress ?? 0}
                  </span>
                </TabsTrigger>
                <TabsTrigger value="completed">
                  已完成{" "}
                  <span className="text-muted-foreground tabular-nums">
                    {counts.data?.progress.completed ?? 0}
                  </span>
                </TabsTrigger>
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
            <ProgressList pages={records.data.pages} stage={search.stage} state={records} />
          )}
        </>
      )}
    </div>
  );
}
