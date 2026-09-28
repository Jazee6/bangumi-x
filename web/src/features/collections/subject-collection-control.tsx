import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, BookmarkCheck, Ellipsis, ListPlus } from "lucide-react";

import { ResponsiveModal } from "@/components/responsive-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { CollectionListForm } from "@/features/collections/collection-list-form";
import {
  collectionListsQueryOptions,
  createCollectionList,
  personalRecordCountsQueryOptions,
  personalSubjectStateQueryOptions,
  removeCollection,
  saveCollection,
} from "@/features/collections/collections-query";
import { useLogin } from "@/components/sign-in";
import { useHydratedSession } from "@/lib/auth-client";

export function SubjectCollectionControl({
  subjectId,
  openAfterLogin = false,
  onIntentConsumed,
}: {
  subjectId: number;
  openAfterLogin?: boolean;
  onIntentConsumed?: () => void;
}) {
  const id = subjectId.toString();
  const queryClient = useQueryClient();
  const intentConsumed = useRef(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [creatingList, setCreatingList] = useState(false);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const { loggingIn, login } = useLogin();
  const { data: session, isPending: sessionPending } = useHydratedSession();
  const state = useQuery({
    ...personalSubjectStateQueryOptions(id),
    enabled: Boolean(session),
  });
  const lists = useQuery({
    ...collectionListsQueryOptions,
    enabled: Boolean(session) && pickerOpen,
  });

  // 收藏与移出会改变收藏库计数和各列表的条目数。
  const invalidateSubject = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["me", "personal-records"] }),
      queryClient.invalidateQueries({ queryKey: personalRecordCountsQueryOptions.queryKey }),
      queryClient.invalidateQueries({ queryKey: collectionListsQueryOptions.queryKey }),
      queryClient.invalidateQueries({
        queryKey: personalSubjectStateQueryOptions(id).queryKey,
      }),
    ]);

  const directMutation = useMutation<
    { collected: true; listIds: string[] } | { collected: false },
    Error,
    boolean
  >({
    mutationFn: (collected: boolean) => (collected ? saveCollection(id, []) : removeCollection(id)),
    onSuccess: async (_result, collected) => {
      await invalidateSubject();
      toast.add({
        title: collected ? "已收藏" : "已取消收藏",
        type: "success",
      });
    },
    onError: (error) => toast.add({ title: error.message, type: "error", priority: "high" }),
  });

  const listMutation = useMutation({
    mutationFn: (listIds: string[]) => saveCollection(id, listIds),
    onSuccess: async () => {
      await invalidateSubject();
      setPickerOpen(false);
      toast.add({ title: "收藏列表已更新", type: "success" });
    },
    onError: (error) => toast.add({ title: error.message, type: "error", priority: "high" }),
  });

  const createListMutation = useMutation({
    mutationFn: createCollectionList,
    onSuccess: async (list) => {
      await queryClient.invalidateQueries({
        queryKey: collectionListsQueryOptions.queryKey,
      });
      setSelectedListIds((current) => [...new Set([...current, list.id])]);
      setCreatingList(false);
      setPickerOpen(true);
      toast.add({ title: "收藏列表已创建", type: "success" });
    },
    onError: (error) => toast.add({ title: error.message, type: "error", priority: "high" }),
  });

  useEffect(() => {
    if (session && openAfterLogin && !intentConsumed.current) {
      intentConsumed.current = true;
      setPickerOpen(true);
      onIntentConsumed?.();
    }
  }, [onIntentConsumed, openAfterLogin, session]);

  useEffect(() => {
    if (pickerOpen && state.data) setSelectedListIds(state.data.listIds);
  }, [pickerOpen, state.data]);

  if (sessionPending) return <Skeleton shape="control" className="h-9 w-24" />;

  if (!session) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={loggingIn}
        onClick={() => void login(`/subjects/${id}?collect=true`)}
      >
        {loggingIn ? <Spinner /> : <Bookmark />}
        {loggingIn ? "登录中" : "收藏"}
      </Button>
    );
  }

  if (state.isPending) return <Skeleton shape="control" className="h-9 w-24" />;
  if (state.isError) {
    return (
      <Button
        type="button"
        variant="outline"
        disabled={state.isFetching}
        onClick={() => void state.refetch()}
      >
        {state.isFetching ? <Spinner /> : <Bookmark />}
        收藏状态加载失败，重试
      </Button>
    );
  }

  const collected = state.data.collected;
  const pending = directMutation.isPending || listMutation.isPending;
  return (
    <>
      <ButtonGroup>
        <Button
          type="button"
          variant={collected ? "secondary" : "outline"}
          disabled={pending}
          onClick={() => directMutation.mutate(!collected)}
        >
          {directMutation.isPending ? <Spinner /> : collected ? <BookmarkCheck /> : <Bookmark />}
          {collected ? "已收藏" : "收藏"}
        </Button>
        <Button
          type="button"
          size="icon"
          variant={collected ? "secondary" : "outline"}
          aria-label="更多收藏操作"
          disabled={pending}
          onClick={() => setPickerOpen(true)}
        >
          <Ellipsis />
        </Button>
      </ButtonGroup>

      <ResponsiveModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        title="收藏到列表"
        description="可同时选择多个列表，保存后更新归属。"
        className="max-h-[85vh] overflow-y-auto sm:max-w-lg"
      >
        <div className="space-y-3 px-6 pb-2 sm:px-0">
          {lists.isPending && (
            <p className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner /> 加载列表
            </p>
          )}
          {lists.isError && (
            <Button
              type="button"
              variant="outline"
              disabled={lists.isFetching}
              onClick={() => void lists.refetch()}
            >
              {lists.isFetching && <Spinner />}
              列表加载失败，重试
            </Button>
          )}
          {lists.data?.data.length === 0 && (
            <Empty variant="outline" size="compact" className="min-h-20">
              <EmptyHeader>
                <EmptyTitle>尚未创建收藏列表</EmptyTitle>
              </EmptyHeader>
            </Empty>
          )}
          <div className="space-y-2">
            {lists.data?.data.map((list) => {
              const selected = selectedListIds.includes(list.id);
              return (
                <Label
                  key={list.id}
                  htmlFor={`collection-list-${list.id}`}
                  variant="option"
                  data-selected={selected}
                  data-disabled={pending}
                >
                  <Checkbox
                    id={`collection-list-${list.id}`}
                    checked={selected}
                    disabled={pending}
                    onCheckedChange={(checked) =>
                      setSelectedListIds((current) =>
                        checked
                          ? [...new Set([...current, list.id])]
                          : current.filter((id) => id !== list.id),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 truncate">{list.name}</span>
                  <Badge variant="secondary" className="ml-auto">
                    <span className="tabular-nums">{list.count ?? 0}</span>
                  </Badge>
                </Label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setCreatingList(true)}>
              <ListPlus />
              新建列表
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => listMutation.mutate(selectedListIds)}
            >
              {listMutation.isPending && <Spinner />}
              {listMutation.isPending ? "保存中" : "保存"}
            </Button>
          </div>
        </div>
      </ResponsiveModal>

      <ResponsiveModal
        open={creatingList}
        onOpenChange={setCreatingList}
        title="新建收藏列表"
        className="sm:max-w-sm"
      >
        <CollectionListForm
          className="px-6 pb-2 sm:px-0"
          mode="create"
          pending={createListMutation.isPending}
          onSubmit={(name) => createListMutation.mutateAsync(name).then(() => undefined)}
        />
      </ResponsiveModal>
    </>
  );
}
