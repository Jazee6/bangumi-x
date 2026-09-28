import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Globe2, Lock, Pencil, Trash2 } from "lucide-react";

import type { CollectionList } from "share";

import { ResponsiveModal } from "@/components/responsive-modal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { CollectionListForm } from "@/features/collections/collection-list-form";
import {
  collectionListsQueryOptions,
  deleteCollectionList,
  personalRecordCountsQueryOptions,
  renameCollectionList,
  setCollectionListVisibility,
} from "@/features/collections/collections-query";

export function SelectedListActions({
  list,
  onDeleted,
}: {
  list: Pick<CollectionList, "id" | "name" | "isPublic" | "shareId">;
  onDeleted: () => void;
}) {
  const queryClient = useQueryClient();
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingPublic, setConfirmingPublic] = useState(false);
  const renameMutation = useMutation({
    mutationFn: (name: string) => renameCollectionList(list.id, name),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: collectionListsQueryOptions.queryKey,
        }),
        queryClient.invalidateQueries({ queryKey: ["me", "personal-records"] }),
      ]);
      setRenaming(false);
      toast.add({ title: "列表已重命名", type: "success" });
    },
    onError: (error) => toast.add({ title: error.message, type: "error", priority: "high" }),
  });
  const visibilityMutation = useMutation({
    mutationFn: () => setCollectionListVisibility(list.id, !list.isPublic),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: collectionListsQueryOptions.queryKey,
      });
      toast.add({
        title: list.isPublic ? "已设为私密" : "已设为公开",
        type: "success",
      });
    },
    onError: (error) => toast.add({ title: error.message, type: "error", priority: "high" }),
  });
  const deleteMutation = useMutation({
    mutationFn: () => deleteCollectionList(list.id),
    onSuccess: async () => {
      // 删除列表可能让条目变为未归入列表，也会改变各条目所属的列表。
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: collectionListsQueryOptions.queryKey,
        }),
        queryClient.invalidateQueries({ queryKey: ["me", "personal-records"] }),
        queryClient.invalidateQueries({ queryKey: personalRecordCountsQueryOptions.queryKey }),
        queryClient.invalidateQueries({ queryKey: ["me", "subjects"] }),
      ]);
      onDeleted();
      toast.add({ title: "列表已删除", type: "success" });
    },
    onError: (error) => toast.add({ title: error.message, type: "error", priority: "high" }),
  });

  return (
    <section className="mt-4 rounded-2xl border p-4" aria-label="当前收藏列表操作">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate font-medium">{list.name}</h2>
          <p className="text-muted-foreground text-xs">{list.isPublic ? "公开" : "私密"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={visibilityMutation.isPending}
            onClick={() => {
              if (list.isPublic) {
                visibilityMutation.mutate();
              } else {
                setConfirmingPublic(true);
              }
            }}
          >
            {visibilityMutation.isPending ? <Spinner /> : list.isPublic ? <Lock /> : <Globe2 />}
            {visibilityMutation.isPending ? "保存中" : list.isPublic ? "设为私密" : "设为公开"}
          </Button>
          {list.isPublic && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const url = `${window.location.origin}/s/${list.shareId}`;
                void navigator.clipboard
                  .writeText(url)
                  .then(() => toast.add({ title: "分享链接已复制", type: "success" }))
                  .catch(() =>
                    toast.add({
                      title: "复制失败，请重试。",
                      type: "error",
                      priority: "high",
                    }),
                  );
              }}
            >
              <Copy />
              复制链接
            </Button>
          )}
          <Button type="button" size="sm" variant="outline" onClick={() => setRenaming(true)}>
            <Pencil /> 重命名
          </Button>
          <Button type="button" size="sm" variant="destructive" onClick={() => setDeleting(true)}>
            <Trash2 /> 删除
          </Button>
        </div>
      </div>
      <ResponsiveModal
        open={renaming}
        onOpenChange={setRenaming}
        title="重命名收藏列表"
        className="sm:max-w-sm"
      >
        <CollectionListForm
          className="px-6 pb-2 sm:px-0"
          mode="rename"
          initialName={list.name}
          pending={renameMutation.isPending}
          onSubmit={(name) => renameMutation.mutateAsync(name).then(() => undefined)}
        />
      </ResponsiveModal>
      <AlertDialog open={confirmingPublic} onOpenChange={setConfirmingPublic}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>设为公开列表？</AlertDialogTitle>
            <AlertDialogDescription>
              设为公开后，该收藏列表和你的站内显示名将对所有获得链接的人公开可见。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel disabled={visibilityMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              disabled={visibilityMutation.isPending}
              onClick={() => {
                visibilityMutation.mutate(undefined, {
                  onSettled: () => setConfirmingPublic(false),
                });
              }}
            >
              {visibilityMutation.isPending && <Spinner />}
              确认公开
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={deleting} onOpenChange={setDeleting}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除“{list.name}”？</AlertDialogTitle>
            <AlertDialogDescription>
              列表和其中的整理关系会被删除，收藏记录会保留。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-end">
            <AlertDialogCancel disabled={deleteMutation.isPending}>取消</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              {deleteMutation.isPending && <Spinner />}
              {deleteMutation.isPending ? "删除中" : "确认删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
