import { useEffect, useState } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, stripSearchParams } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { SUBJECT_TYPE_FILTER_LABELS, SUBJECT_TYPE_FILTER_VALUES } from "share";
import type { SubjectTypeFilter } from "share";

import { HeaderTitle } from "@/components/app-shell";
import { KeywordSearchForm } from "@/components/keyword-search-form";
import { SignInEmpty } from "@/components/sign-in";
import { ResponsiveModal } from "@/components/responsive-modal";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/components/ui/toast";
import { CollectionListForm } from "@/features/collections/collection-list-form";
import { SelectedListActions } from "@/features/collections/list-actions";
import {
  collectionListsQueryOptions,
  createCollectionList,
  personalRecordCountsQueryOptions,
  personalRecordsQueryOptions,
} from "@/features/collections/collections-query";
import {
  CollectionsError,
  CollectionsLoading,
  PersonalRecordsGrid,
} from "@/features/collections/collections-view";
import {
  DEFAULT_COLLECTIONS_SEARCH,
  updateCollectionsSearch,
  validateCollectionsSearch,
  type CollectionsSearch,
} from "@/features/collections/collections-search";
import { useHydratedSession } from "@/lib/auth-client";
import { buildPageHead, PRIVATE_HEADERS } from "@/lib/seo";

export const Route = createFileRoute("/_app/collections")({
  head: () =>
    buildPageHead({
      title: "个人收藏",
      description: "管理你的 Bangumi X 私人收藏。",
      canonicalPath: "/collections",
      publication: { state: "noindex-nofollow", reason: "private-user-state" },
    }),
  headers: () => PRIVATE_HEADERS,
  validateSearch: validateCollectionsSearch,
  search: { middlewares: [stripSearchParams(DEFAULT_COLLECTIONS_SEARCH)] },
  component: CollectionsPage,
});

function CollectionsSessionLoading() {
  return (
    <div aria-busy="true">
      <div className="mt-4 flex flex-wrap items-start gap-3">
        <Skeleton shape="badge" className="h-9 w-28" />
        <div className="flex min-w-56 flex-1 gap-2">
          <Skeleton shape="badge" className="h-9 flex-1" />
          <Skeleton shape="control" className="h-9 w-20" />
        </div>
      </div>
      <div className="mt-4 overflow-hidden pb-1">
        <Skeleton shape="pill" className="h-9 w-64 max-w-full" />
      </div>
      <CollectionsLoading />
    </div>
  );
}

function CollectionsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const [creatingList, setCreatingList] = useState(false);
  const { data: session, isPending: sessionPending } = useHydratedSession();
  const records = useInfiniteQuery({
    ...personalRecordsQueryOptions(search),
    enabled: Boolean(session),
  });
  const lists = useQuery({
    ...collectionListsQueryOptions,
    enabled: Boolean(session),
  });
  const counts = useQuery({
    ...personalRecordCountsQueryOptions,
    enabled: Boolean(session),
  });
  const unlistedCount = counts.data?.collections.unlisted ?? 0;
  const createMutation = useMutation({
    mutationFn: createCollectionList,
    onSuccess: async (list) => {
      await queryClient.invalidateQueries({
        queryKey: collectionListsQueryOptions.queryKey,
      });
      setCreatingList(false);
      toast.add({ title: `列表「${list.name}」已创建`, type: "success" });
      void navigate({ search: { ...search, list: list.id }, resetScroll: false });
    },
    onError: (error) => toast.add({ title: error.message, type: "error", priority: "high" }),
  });

  function updateSearch(patch: Partial<CollectionsSearch>) {
    void navigate({
      search: updateCollectionsSearch(search, patch),
      resetScroll: false,
    });
  }

  useEffect(() => {
    if (counts.data && search.list === "unlisted" && unlistedCount === 0) {
      void navigate({
        search: updateCollectionsSearch(search, { list: undefined }),
        replace: true,
        resetScroll: false,
      });
    }
  }, [counts.data, navigate, search, unlistedCount]);

  const selectedList = search.list
    ? lists.data?.data.find((list) => list.id === search.list)
    : undefined;
  const filtered = Boolean(search.list || search.type || search.keyword);

  const typeItems = [
    { value: "all", label: "全部类型" },
    ...SUBJECT_TYPE_FILTER_VALUES.map((value) => ({
      value,
      label: SUBJECT_TYPE_FILTER_LABELS[value],
    })),
  ];

  return (
    <div className="mx-auto w-full p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <HeaderTitle className="text-3xl font-semibold tracking-tight">收藏</HeaderTitle>
        {sessionPending ? (
          <Skeleton shape="control" className="h-9 w-28" />
        ) : (
          session && (
            <Button type="button" className="self-center" onClick={() => setCreatingList(true)}>
              <Plus /> 新建列表
            </Button>
          )
        )}
      </div>

      {session && (
        <ResponsiveModal
          open={creatingList}
          onOpenChange={setCreatingList}
          title="新建收藏列表"
          className="sm:max-w-sm"
        >
          <CollectionListForm
            className="px-6 pb-2 sm:px-0"
            mode="create"
            pending={createMutation.isPending}
            onSubmit={(name) => createMutation.mutateAsync(name).then(() => undefined)}
          />
        </ResponsiveModal>
      )}

      {sessionPending && <CollectionsSessionLoading />}
      {!sessionPending && !session && (
        <SignInEmpty
          title="登录后查看收藏"
          description="登录后可管理收藏列表。"
          returnTo="/collections"
        />
      )}

      {session && (
        <>
          <div className="mt-4 flex flex-wrap items-start gap-3">
            <Select
              items={typeItems}
              value={search.type ?? "all"}
              onValueChange={(value) =>
                updateSearch({
                  type: value === "all" ? undefined : (value as SubjectTypeFilter),
                })
              }
            >
              <SelectTrigger aria-label="条目类型">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="all">全部类型</SelectItem>
                {SUBJECT_TYPE_FILTER_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {SUBJECT_TYPE_FILTER_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <KeywordSearchForm
              className="min-w-56 flex-1"
              label="搜索个人条目"
              placeholder="搜索标题"
              keyword={search.keyword}
              searching={records.isFetching}
              onSubmit={(keyword) => updateSearch({ keyword })}
              onClear={() => updateSearch({ keyword: undefined })}
            />
          </div>

          <div className="mt-4 overflow-x-auto pb-1">
            <Tabs
              value={search.list ?? "all"}
              onValueChange={(value) => updateSearch({ list: value === "all" ? undefined : value })}
            >
              <TabsList aria-label="收藏列表范围">
                <TabsTrigger value="all">
                  全部收藏{" "}
                  <span className="text-muted-foreground tabular-nums">
                    {counts.data?.collections.all ?? 0}
                  </span>
                </TabsTrigger>
                {unlistedCount > 0 && (
                  <TabsTrigger value="unlisted">
                    未归入列表{" "}
                    <span className="text-muted-foreground tabular-nums">{unlistedCount}</span>
                  </TabsTrigger>
                )}
                {lists.data?.data.map((list) => (
                  <TabsTrigger key={list.id} value={list.id}>
                    {list.name}{" "}
                    <span className="text-muted-foreground tabular-nums">{list.count ?? 0}</span>
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          {selectedList && (
            <SelectedListActions
              key={selectedList.id}
              list={selectedList}
              onDeleted={() => updateSearch({ list: undefined })}
            />
          )}
          {lists.isError && (
            <CollectionsError
              title="收藏列表加载失败"
              message={lists.error.message}
              retrying={lists.isFetching}
              onRetry={() => void lists.refetch()}
            />
          )}
          {records.isPending && <CollectionsLoading />}
          {records.isError && !records.data && (
            <CollectionsError
              message={records.error.message}
              retrying={records.isFetching}
              onRetry={() => void records.refetch()}
            />
          )}
          {records.data && (
            <PersonalRecordsGrid pages={records.data.pages} filtered={filtered} state={records} />
          )}
        </>
      )}
    </div>
  );
}
